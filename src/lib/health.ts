import { db } from "./db";
import { ownedPet } from "./pets";
import { HttpError } from "./http";
import { healthInput, contextInput, healthOverview } from "./health-rules";
import type { Prisma } from "@/generated/prisma/client";
const attachmentSelect = {
  id: true,
  filename: true,
  description: true,
  mime: true,
  bytes: true,
  createdAt: true,
};
export const healthInclude = {
  encounter: true,
  medication: true,
  vaccination: true,
  problem: true,
  allergy: true,
  procedure: true,
  attachments: {
    where: { deletedAt: null },
    select: attachmentSelect,
    orderBy: { createdAt: "asc" as const },
  },
};
export type FullHealthRecord = Prisma.HealthRecordGetPayload<{
  include: typeof healthInclude;
}>;
export function snapshot(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value));
}
export function validId(id: string) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    throw new HttpError(404, "Record not found.");
}
export async function lockHealthPet(
  tx: Prisma.TransactionClient,
  ownerId: string,
  petId: string,
) {
  validId(petId);
  await tx.$queryRaw`SELECT id FROM "Pet" WHERE id=${petId}::uuid AND "ownerId"=${ownerId}::uuid FOR UPDATE`;
  const p = await tx.pet.findFirst({ where: { id: petId, ownerId } });
  if (!p) throw new HttpError(404, "Pet not found.");
  return p;
}
export async function healthRecordFor(
  ownerId: string,
  petId: string,
  id: string,
  removed = false,
) {
  await ownedPet(ownerId, petId);
  validId(id);
  const r = await db.healthRecord.findFirst({
    where: { id, petId, ...(removed ? {} : { deletedAt: null }) },
    include: healthInclude,
  });
  if (!r) throw new HttpError(404, "Record not found.");
  return r;
}
export async function healthData(
  ownerId: string,
  petId: string,
  today: string,
) {
  const pet = await ownedPet(ownerId, petId);
  const records = await db.healthRecord.findMany({
    where: { petId },
    include: healthInclude,
    orderBy: [
      { occurredOn: { sort: "desc", nulls: "last" } },
      { createdAt: "desc" },
    ],
  });
  const context = await db.petHealthContext.findUnique({ where: { petId } });
  return {
    records,
    context,
    overview: healthOverview(records, pet.status, today),
  };
}
const calendar = (v: string | null | undefined) =>
  v ? new Date(v + "T00:00:00Z") : null;
async function resetAllergyKnowledge(
  tx: Prisma.TransactionClient,
  petId: string,
  ownerId: string,
) {
  const old = await tx.petHealthContext.findUnique({ where: { petId } });
  if (old?.allergyKnowledge !== "NO_KNOWN") return;
  const saved = await tx.petHealthContext.update({
    where: { petId },
    data: {
      allergyKnowledge: "UNKNOWN",
      updatedBy: ownerId,
      version: { increment: 1 },
    },
  });
  await tx.healthContextRevision.create({
    data: {
      petId,
      version: saved.version,
      actorId: ownerId,
      snapshot: snapshot(saved),
    },
  });
}
export async function saveHealthRecord(
  ownerId: string,
  petId: string,
  raw: unknown,
  id?: string,
) {
  const input = healthInput.parse(raw);
  if (id) validId(id);
  return db.$transaction(async (tx) => {
    await lockHealthPet(tx, ownerId, petId);
    const old = id
      ? await tx.healthRecord.findFirst({
          where: { id, petId, deletedAt: null },
          include: healthInclude,
        })
      : null;
    if (id && !old) throw new HttpError(404, "Record not found.");
    if (old && (old.version !== input.version || old.kind !== input.kind))
      throw new HttpError(
        409,
        "This record has changed. Reopen it before saving; your current draft has not been discarded.",
      );
    if (input.linkedEncounterId) {
      const visit = await tx.healthRecord.findFirst({
        where: {
          id: input.linkedEncounterId,
          petId,
          kind: "VISIT",
          deletedAt: null,
        },
      });
      if (!visit)
        throw new HttpError(
          400,
          "Choose a current vet visit belonging to this pet.",
        );
    }
    const common = {
      title: input.title,
      occurredOn:
        input.datePrecision === "UNKNOWN" ? null : calendar(input.occurredOn),
      datePrecision: input.datePrecision,
      notes: input.notes,
      sourceType: input.sourceType,
      sourceClinic: input.sourceClinic,
      linkedEncounterId: input.linkedEncounterId,
      updatedBy: ownerId,
    };
    const r = old
      ? await tx.healthRecord.update({
          where: { id: old.id },
          data: { ...common, version: { increment: 1 } },
        })
      : await tx.healthRecord.create({
          data: { ...common, petId, kind: input.kind, enteredBy: ownerId },
        });
    const recordId = r.id;
    if (input.kind === "VISIT") {
      const data = {
        vetSaid: input.vetSaid,
        treatment: input.treatment,
        outcome: input.outcome,
      };
      await tx.encounter.upsert({
        where: { recordId },
        create: { recordId, ...data },
        update: data,
      });
    }
    if (input.kind === "MEDICATION") {
      const data = {
        instructions: input.instructions,
        indication: input.indication,
        startDate: calendar(input.startDate),
        endDate: calendar(input.endDate),
        status: input.status as "ACTIVE" | "COMPLETED" | "STOPPED" | "UNKNOWN",
      };
      await tx.medication.upsert({
        where: { recordId },
        create: { recordId, ...data },
        update: data,
      });
    }
    if (input.kind === "VACCINATION") {
      const data = {
        nextDueDate: calendar(input.nextDueDate),
        batch: input.batch,
      };
      await tx.vaccination.upsert({
        where: { recordId },
        create: { recordId, ...data },
        update: data,
      });
    }
    if (input.kind === "PROBLEM") {
      const data = {
        status: input.status as "ACTIVE" | "RESOLVED" | "UNKNOWN",
      };
      await tx.medicalProblem.upsert({
        where: { recordId },
        create: { recordId, ...data },
        update: data,
      });
    }
    if (input.kind === "ALLERGY") {
      await resetAllergyKnowledge(tx, petId, ownerId);
      const data = { reaction: input.reaction, severity: input.severity };
      await tx.allergy.upsert({
        where: { recordId },
        create: { recordId, ...data },
        update: data,
      });
    }
    if (input.kind === "PROCEDURE") {
      const data = { outcome: input.outcome, major: input.major };
      await tx.procedure.upsert({
        where: { recordId },
        create: { recordId, ...data },
        update: data,
      });
    }
    const saved = await tx.healthRecord.findUniqueOrThrow({
      where: { id: recordId },
      include: healthInclude,
    });
    await tx.healthRevision.create({
      data: {
        recordId,
        version: saved.version,
        actorId: ownerId,
        action: old ? "Corrected record" : "Created record",
        snapshot: snapshot(saved),
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: ownerId,
        petId,
        action: old ? "Updated a health record" : "Added a health record",
      },
    });
    return saved;
  });
}
export async function removeOrRestoreHealth(
  ownerId: string,
  petId: string,
  id: string,
  version: number,
  restore = false,
) {
  validId(id);
  return db.$transaction(async (tx) => {
    await lockHealthPet(tx, ownerId, petId);
    const old = await tx.healthRecord.findFirst({ where: { id, petId } });
    if (!old) throw new HttpError(404, "Record not found.");
    if (old.version !== version)
      throw new HttpError(409, "The record changed. Refresh it and try again.");
    if (Boolean(old.deletedAt) !== restore)
      throw new HttpError(
        400,
        restore
          ? "This record is not removed."
          : "This record is already removed.",
      );
    if (restore && old.kind === "ALLERGY")
      await resetAllergyKnowledge(tx, petId, ownerId);
    const r = await tx.healthRecord.update({
      where: { id },
      data: {
        deletedAt: restore ? null : new Date(),
        version: { increment: 1 },
        updatedBy: ownerId,
      },
      include: healthInclude,
    });
    await tx.healthRevision.create({
      data: {
        recordId: id,
        version: r.version,
        actorId: ownerId,
        action: restore ? "Restored record" : "Removed from normal views",
        snapshot: snapshot(r),
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: ownerId,
        petId,
        action: restore
          ? "Restored a health record"
          : "Removed a health record",
      },
    });
    return r;
  });
}
export async function saveHealthContext(
  ownerId: string,
  petId: string,
  raw: unknown,
) {
  const input = contextInput.parse(raw);
  return db.$transaction(async (tx) => {
    await lockHealthPet(tx, ownerId, petId);
    const old = await tx.petHealthContext.findUnique({ where: { petId } });
    if ((old?.version || 0) !== input.version)
      throw new HttpError(409, "These notes changed. Refresh before saving.");
    if (
      input.allergyKnowledge === "NO_KNOWN" &&
      (await tx.healthRecord.count({
        where: { petId, kind: "ALLERGY", deletedAt: null },
      }))
    )
      throw new HttpError(
        400,
        "Recorded allergies are present. Review them before stating no known allergies.",
      );
    const data = {
      emergencyNotes: input.emergencyNotes,
      allergyKnowledge: input.allergyKnowledge,
      updatedBy: ownerId,
    };
    const saved = await tx.petHealthContext.upsert({
      where: { petId },
      create: { petId, ...data },
      update: { ...data, version: { increment: 1 } },
    });
    await tx.healthContextRevision.create({
      data: {
        petId,
        version: saved.version,
        actorId: ownerId,
        snapshot: snapshot(saved),
      },
    });
    return saved;
  });
}
