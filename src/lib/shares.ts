import { createHash, randomBytes } from "node:crypto";
import QRCode from "qrcode";
import { db } from "./db";
import { ownedPet } from "./pets";
import {
  healthInclude,
  lockHealthPet,
  snapshot,
  validId,
  type FullHealthRecord,
} from "./health";
import { healthOverview, dateLabel, sourceLabels } from "./health-rules";
import { ageLabel } from "./pet-rules";
import { HttpError } from "./http";
import {
  selectionInput,
  createShareInput,
  sectionNames,
  shareStatus,
  type ShareSelection,
  type SummaryContent,
  type SnapshotField,
  type SnapshotItem,
  type SectionKey,
} from "./share-rules";
import type { Prisma } from "@/generated/prisma/client";
export const shareHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  Vary: "Cookie, Origin",
};
export const tokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
function fields(
  values: [string, string | null | undefined][],
): SnapshotField[] {
  return values
    .filter(
      ([, value]) => value !== null && value !== undefined && value !== "",
    )
    .map(([label, value]) => ({ label, value: value! }));
}
const statusLabel = (v: string | undefined) =>
  v
    ? v === "UNKNOWN"
      ? "Unknown / not recorded"
      : v.charAt(0) + v.slice(1).toLowerCase()
    : null;
function item(r: FullHealthRecord, s: ShareSelection): SnapshotItem {
  const detail: [string, string | null | undefined][] = [
    [
      "Date",
      `${r.datePrecision === "APPROXIMATE" ? "Around " : ""}${dateLabel(r.occurredOn)}`,
    ],
    ["Source", sourceLabels[r.sourceType]],
    ["Clinic", s.clinicNames ? r.sourceClinic : null],
  ];
  if (r.medication)
    detail.push(
      ["Status", statusLabel(r.medication.status)],
      ["Instructions", s.freeText ? r.medication.instructions : null],
      ["For", s.freeText ? r.medication.indication : null],
      [
        "Start date",
        r.medication.startDate ? dateLabel(r.medication.startDate) : null,
      ],
      [
        "End date",
        r.medication.endDate ? dateLabel(r.medication.endDate) : null,
      ],
    );
  if (r.problem) detail.push(["Status", statusLabel(r.problem.status)]);
  if (r.allergy)
    detail.push(
      ["Reaction", s.freeText ? r.allergy.reaction : null],
      ["Severity", statusLabel(r.allergy.severity)],
    );
  if (r.vaccination)
    detail.push([
      "Next due date",
      r.vaccination.nextDueDate
        ? dateLabel(r.vaccination.nextDueDate)
        : "Not recorded",
    ]);
  if (r.encounter && s.freeText)
    detail.push(
      ["Vet said", r.encounter.vetSaid],
      ["Treatment or advice", r.encounter.treatment],
      ["Outcome", r.encounter.outcome || "Not recorded"],
    );
  if (r.procedure && s.freeText)
    detail.push(["Outcome", r.procedure.outcome || "Not recorded"]);
  if (s.freeText) detail.push(["Notes", r.notes]);
  return { title: r.title, fields: fields(detail) };
}
export async function previewSummary(
  ownerId: string,
  petId: string,
  raw: unknown,
) {
  const s = selectionInput.parse(raw);
  return db.$transaction(async (tx) => {
    const pet = await lockHealthPet(tx, ownerId, petId),
      creator = await tx.user.findUniqueOrThrow({ where: { id: ownerId } }),
      custody = await tx.petOwnership.findFirst({
        where: { petId, ownerId, endedAt: null },
      });
    if (!custody)
      throw new HttpError(409, "Current custody could not be confirmed.");
    if (
      (await tx.healthSummarySnapshot.count({
        where: { petId, createdAt: { gte: new Date(Date.now() - 86400000) } },
      })) >= 100
    )
      throw new HttpError(
        429,
        "This pet has reached the daily preview limit. Try again tomorrow.",
      );
    const records = await tx.healthRecord.findMany({
      where: { petId, deletedAt: null },
      include: healthInclude,
      orderBy: [
        { occurredOn: { sort: "desc", nulls: "last" } },
        { createdAt: "desc" },
      ],
    });
    const context = await tx.petHealthContext.findUnique({ where: { petId } });
    const now = new Date();
    const o = healthOverview(
      records,
      pet.status,
      now.toISOString().slice(0, 10),
    );
    const groups: Record<
      Exclude<SectionKey, "emergencyNotes">,
      FullHealthRecord[]
    > = {
      allergies: o.allergies,
      medications: [...o.activeMedications, ...o.unknownMedications],
      problems: [...o.activeProblems, ...o.unknownProblems],
      vaccinations: o.vaccinations,
      visits: o.visits,
      procedures: o.procedures.filter((r) => r.procedure?.major),
    };
    const limits = {
      allergies: 30,
      medications: 30,
      problems: 30,
      vaccinations: 6,
      visits: 3,
      procedures: 5,
    };
    const content: SummaryContent = {
      version: 1,
      heading: s.petName
        ? `${pet.name}’s health summary`
        : "Pet health summary",
      capturedAt: now.toISOString(),
      lastUpdated:
        records.length || context
          ? new Date(
              Math.max(
                ...records.map((r) => r.updatedAt.getTime()),
                context?.updatedAt.getTime() || 0,
              ),
            ).toISOString()
          : null,
      identity: fields([
        ["Pet", s.petName ? pet.name : null],
        [
          "Species",
          s.demographics ? (pet.species === "DOG" ? "Dog" : "Cat") : null,
        ],
        ["Breed", s.demographics ? pet.breed || "Unknown" : null],
        [
          "Age",
          s.demographics
            ? ageLabel(pet.birthDate?.toISOString() || null, pet.birthPrecision)
            : null,
        ],
        ["Sex", s.demographics ? statusLabel(pet.sex) : null],
        ["Owner", s.ownerName ? creator.name : null],
        ["Microchip", s.microchip ? pet.microchip || "Not recorded" : null],
      ]),
      sections: [],
      provenance:
        "Owner-maintained information, not veterinarian-verified. This is a frozen snapshot; later changes are not included.",
      omissionNotice:
        "The owner selected this information. Omitted items are not evidence that a condition is absent. Documents, attachments and access to the live record are excluded.",
    };
    for (const key of [...new Set(s.sections)]) {
      if (key === "emergencyNotes") {
        content.sections.push({
          key,
          title: sectionNames[key],
          note: s.freeText ? "" : "Free-text details excluded by owner.",
          items:
            s.freeText && context?.emergencyNotes
              ? [
                  {
                    title: "Owner-entered emergency notes",
                    fields: [{ label: "Notes", value: context.emergencyNotes }],
                  },
                ]
              : [],
        });
        continue;
      }
      const all = groups[key],
        selected = all.filter((r) => !s.excludedRecordIds.includes(r.id)),
        limited = selected.slice(0, limits[key]);
      let note = "";
      if (selected.length < all.length)
        note += "Some entries were excluded by the owner. ";
      if (selected.length > limits[key])
        note += `Showing ${limits[key]} of ${selected.length} selected entries. `;
      if (key === "allergies" && !all.length)
        note +=
          context?.allergyKnowledge === "NO_KNOWN"
            ? "No known allergies — reported by owner."
            : "No allergies recorded; whether allergies are present is unknown.";
      if (key === "vaccinations")
        note +=
          "Entered dates only; this is not a clinical assessment of vaccination coverage.";
      content.sections.push({
        key,
        title: sectionNames[key],
        note: note.trim(),
        items: limited.map((r) => item(r, s)),
      });
    }
    if (Buffer.byteLength(JSON.stringify(content)) > 512 * 1024)
      throw new HttpError(
        400,
        "This summary is too large. Exclude some details and preview again.",
      );
    const preview = await tx.healthSummarySnapshot.create({
      data: {
        petId,
        createdBy: ownerId,
        custodyId: custody.id,
        content: snapshot(content),
        selection: snapshot(s),
        createdAt: now,
        draftExpiresAt: new Date(now.getTime() + 15 * 60000),
      },
    });
    return { id: preview.id, content, draftExpiresAt: preview.draftExpiresAt };
  });
}
export async function createSummaryShare(
  ownerId: string,
  petId: string,
  raw: unknown,
) {
  const input = createShareInput.parse(raw),
    token = randomBytes(32).toString("base64url");
  const origin = new URL(process.env.BETTER_AUTH_URL!).origin;
  const url = `${origin}/shared#${token}`;
  const qr = await QRCode.toDataURL(url, {
    width: 280,
    margin: 4,
    errorCorrectionLevel: "M",
  });
  return db.$transaction(async (tx) => {
    await lockHealthPet(tx, ownerId, petId);
    const draft = await tx.healthSummarySnapshot.findFirst({
      where: { id: input.snapshotId, petId, createdBy: ownerId },
      include: { share: true, custody: true },
    });
    const now = new Date();
    if (!draft) throw new HttpError(404, "Snapshot not found.");
    if (draft.share)
      throw new HttpError(
        409,
        "A link was already created for this preview. Manage it in Shared links; preview again to create another.",
      );
    if (draft.draftExpiresAt <= now || draft.custody.endedAt)
      throw new HttpError(
        409,
        "This preview expired or custody changed. Preview the summary again.",
      );
    if (
      (await tx.healthSummaryShare.count({
        where: {
          snapshot: { petId },
          revokedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
      })) >= 50
    )
      throw new HttpError(
        429,
        "This pet has 50 active links. Revoke older links before creating another.",
      );
    const duration = {
      HOUR: 3600000,
      DAY: 86400000,
      WEEK: 604800000,
      UNTIL_REVOKED: 0,
    }[input.expiry];
    const share = await tx.healthSummaryShare.create({
      data: {
        snapshotId: draft.id,
        tokenHash: tokenHash(token),
        createdAt: now,
        expiresAt: duration ? new Date(now.getTime() + duration) : null,
      },
    });
    await tx.auditLog.create({
      data: {
        petId,
        actorId: ownerId,
        action: "Created an owner-selected health-summary link",
      },
    });
    return {
      id: share.id,
      createdAt: share.createdAt,
      expiresAt: share.expiresAt,
      url,
      qr,
      content: draft.content,
    };
  });
}
export async function listSummaryShares(ownerId: string, petId: string) {
  await ownedPet(ownerId, petId);
  const now = new Date();
  const rows = await db.healthSummaryShare.findMany({
    where: { snapshot: { petId, createdBy: ownerId } },
    select: {
      id: true,
      createdAt: true,
      expiresAt: true,
      revokedAt: true,
      snapshot: { select: { createdAt: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return {
    shares: rows.map((r) => ({ ...r, status: shareStatus(r, now) })),
    serverNow: now.toISOString(),
    limit: 200,
  };
}
export async function ownerShareSnapshot(
  ownerId: string,
  petId: string,
  id: string,
) {
  await ownedPet(ownerId, petId);
  validId(id);
  const share = await db.healthSummaryShare.findFirst({
    where: { id, snapshot: { petId, createdBy: ownerId } },
    select: { snapshot: { select: { content: true } } },
  });
  if (!share) throw new HttpError(404, "Shared link not found.");
  return share.snapshot.content;
}
export async function revokePetShares(
  tx: Prisma.TransactionClient,
  petId: string,
) {
  return tx.healthSummaryShare.updateMany({
    where: { snapshot: { petId }, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
export async function revokeSummaryShare(
  ownerId: string,
  petId: string,
  id: string,
) {
  if (id !== "all") validId(id);
  return db.$transaction(async (tx) => {
    await lockHealthPet(tx, ownerId, petId);
    const where = {
      snapshot: { petId, createdBy: ownerId },
      ...(id === "all" ? {} : { id }),
    };
    if (id !== "all" && !(await tx.healthSummaryShare.findFirst({ where })))
      throw new HttpError(404, "Shared link not found.");
    const result = await tx.healthSummaryShare.updateMany({
      where: { ...where, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        petId,
        actorId: ownerId,
        action:
          id === "all"
            ? "Revoked health-summary links"
            : "Revoked a health-summary link",
      },
    });
    return { revoked: result.count };
  });
}
export async function resolveSummaryShare(token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token))
    throw new HttpError(404, "This shared summary is not available.");
  const share = await db.healthSummaryShare.findUnique({
    where: { tokenHash: tokenHash(token) },
    include: {
      snapshot: {
        include: {
          pet: { select: { ownerId: true } },
          custody: { select: { endedAt: true, ownerId: true } },
        },
      },
    },
  });
  const now = new Date();
  if (
    !share ||
    share.revokedAt ||
    (share.expiresAt && share.expiresAt <= now) ||
    share.snapshot.pet.ownerId !== share.snapshot.createdBy ||
    share.snapshot.custody.endedAt ||
    share.snapshot.custody.ownerId !== share.snapshot.createdBy
  )
    throw new HttpError(404, "This shared summary is not available.");
  return {
    content: share.snapshot.content,
    createdAt: share.createdAt,
    expiresAt: share.expiresAt,
    serverNow: now.toISOString(),
  };
}
