import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { PDFDocument, PDFName, PDFString } from "pdf-lib";
import { healthInput, healthOverview } from "../src/lib/health-rules";
import {
  saveHealthRecord,
  saveHealthContext,
  removeOrRestoreHealth,
  healthData,
} from "../src/lib/health";
import {
  validateHealthFile,
  addHealthFile,
  removeHealthFile,
} from "../src/lib/health-files";
import { savePet } from "../src/lib/pets";
import { db } from "../src/lib/db";
import { deleteObject, getObject } from "../src/lib/storage";
test("health rules preserve unknowns, explicit statuses and entered due dates", () => {
  assert.equal(
    healthInput.parse({ kind: "MEDICATION", title: "Unknown prescription" })
      .status,
    "UNKNOWN",
  );
  assert.equal(
    healthInput.safeParse({ kind: "VISIT", title: "Checkup" }).success,
    false,
  );
  assert.equal(
    healthInput.safeParse({
      kind: "NOTE",
      title: "Bad date",
      occurredOn: "2025-02-30",
      datePrecision: "EXACT",
    }).success,
    false,
  );
  assert.equal(
    healthInput.safeParse({
      kind: "NOTE",
      title: "Future",
      occurredOn: "2099-01-01",
      datePrecision: "EXACT",
    }).success,
    false,
  );
  assert.equal(
    healthInput.safeParse({
      kind: "MEDICATION",
      title: "x",
      status: "RESOLVED",
    }).success,
    false,
  );
  const base = {
    id: "1",
    title: "v",
    kind: "VACCINATION",
    occurredOn: null,
    updatedAt: "2026-01-01",
    deletedAt: null,
  };
  const records = [
    { ...base, vaccination: { nextDueDate: null } },
    { ...base, id: "2", vaccination: { nextDueDate: "2026-09-20" } },
  ];
  const o = healthOverview(records, "ACTIVE", "2026-09-15");
  assert.equal(o.missingDueDates, 1);
  assert.equal(o.reminders.length, 1);
  assert.equal(o.reminders[0].days, 5);
  for (const status of ["ARCHIVED", "DECEASED"])
    assert.equal(
      healthOverview(records, status, "2026-09-15").reminders.length,
      0,
    );
});
test("file validation rejects spoofed and interactive files and strips image metadata", async () => {
  await assert.rejects(
    () =>
      validateHealthFile(
        new File(["fake"], "fake.pdf", { type: "application/pdf" }),
      ),
    /valid/,
  );
  const pdf = await PDFDocument.create();
  pdf.addPage();
  pdf.catalog.set(
    PDFName.of("OpenAction"),
    pdf.context.obj({ S: "JavaScript", JS: PDFString.of('app.alert("test")') }),
  );
  await assert.rejects(
    async () =>
      validateHealthFile(
        new File([new Uint8Array(await pdf.save())], "active.pdf"),
      ),
    /interactive/,
  );
  const image = await sharp({
    create: { width: 40, height: 40, channels: 3, background: "#efa765" },
  })
    .withExif({ IFD0: { Artist: "Private fixture" } })
    .jpeg()
    .toBuffer();
  const result = await validateHealthFile(
    new File([new Uint8Array(image)], "image.jpg"),
  );
  assert.equal((await sharp(result.body).metadata()).exif, undefined);
  assert.equal(result.mime, "image/webp");
});
test("health custody, revisions, linking, restore and concurrent file limits", async () => {
  const owner = await db.user.findUniqueOrThrow({
      where: { email: "sarah@petish.test" },
    }),
    other = await db.user.findUniqueOrThrow({
      where: { email: "james@petish.test" },
    });
  const p = await savePet(owner.id, {
      name: "Phase2 integration fixture",
      species: "DOG",
    }),
    p2 = await savePet(owner.id, {
      name: "Phase2 linking fixture",
      species: "CAT",
    });
  try {
    let visit = await saveHealthRecord(owner.id, p.id, {
      kind: "VISIT",
      title: "Short visit",
      datePrecision: "EXACT",
      occurredOn: "2026-01-01",
    });
    assert.equal(visit.encounter?.outcome, null);
    await assert.rejects(
      () => saveHealthRecord(other.id, p.id, { kind: "NOTE", title: "Denied" }),
      /not found/,
    );
    await assert.rejects(
      () => healthData(other.id, p.id, "2026-09-15"),
      /not found/,
    );
    await assert.rejects(
      () =>
        saveHealthRecord(owner.id, p2.id, {
          kind: "MEDICATION",
          title: "Wrong pet",
          linkedEncounterId: visit.id,
        }),
      /belonging/,
    );
    const med = await saveHealthRecord(owner.id, p.id, {
      kind: "MEDICATION",
      title: "Undated medicine",
      linkedEncounterId: visit.id,
    });
    assert.equal(med.occurredOn, null);
    assert.equal(med.medication?.status, "UNKNOWN");
    visit = await saveHealthRecord(
      owner.id,
      p.id,
      {
        kind: "VISIT",
        title: "Short visit",
        datePrecision: "EXACT",
        occurredOn: "2026-01-01",
        outcome: "Better later",
        version: visit.version,
      },
      visit.id,
    );
    assert.equal(visit.enteredBy, owner.id);
    assert.equal(
      await db.healthRevision.count({ where: { recordId: visit.id } }),
      2,
    );
    await assert.rejects(
      () =>
        saveHealthRecord(
          owner.id,
          p.id,
          {
            kind: "VISIT",
            title: "Stale",
            datePrecision: "EXACT",
            occurredOn: "2026-01-01",
            version: 1,
          },
          visit.id,
        ),
      /changed/,
    );
    await saveHealthContext(owner.id, p.id, {
      allergyKnowledge: "NO_KNOWN",
      version: 0,
    });
    let allergy = await saveHealthRecord(owner.id, p.id, {
      kind: "ALLERGY",
      title: "Suspected trigger",
    });
    assert.equal(
      (await db.petHealthContext.findUniqueOrThrow({ where: { petId: p.id } }))
        .allergyKnowledge,
      "UNKNOWN",
    );
    allergy = await removeOrRestoreHealth(
      owner.id,
      p.id,
      allergy.id,
      allergy.version,
    );
    assert.equal(
      (await healthData(owner.id, p.id, "2026-09-15")).overview.allergies
        .length,
      0,
    );
    const ctx = await db.petHealthContext.findUniqueOrThrow({
      where: { petId: p.id },
    });
    await saveHealthContext(owner.id, p.id, {
      allergyKnowledge: "NO_KNOWN",
      version: ctx.version,
    });
    await removeOrRestoreHealth(
      owner.id,
      p.id,
      allergy.id,
      allergy.version,
      true,
    );
    assert.equal(
      (await db.petHealthContext.findUniqueOrThrow({ where: { petId: p.id } }))
        .allergyKnowledge,
      "UNKNOWN",
    );
    const pdf = await PDFDocument.create();
    pdf.addPage();
    const bytes = new Uint8Array(await pdf.save());
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, () =>
        addHealthFile(
          owner.id,
          p.id,
          visit.id,
          new File([bytes], "safe.pdf"),
          "Private report",
        ),
      ),
    );
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 5);
    const file = await db.attachment.findFirstOrThrow({
      where: { recordId: visit.id },
    });
    assert.ok((await getObject(file.objectKey)).length);
    const current = await db.healthRecord.findUniqueOrThrow({
      where: { id: visit.id },
    });
    const removed = await removeHealthFile(
      owner.id,
      p.id,
      visit.id,
      file.id,
      current.version,
    );
    assert.equal(removed.attachments.length, 4);
    assert.ok((await getObject(file.objectKey)).length);
    assert.equal(
      (await healthData(owner.id, p.id, "2026-09-15")).records.filter(
        (r) => r.id === med.id,
      ).length,
      1,
    );
  } finally {
    for (const id of [p.id, p2.id]) {
      const files = await db.attachment.findMany({
        where: { record: { petId: id } },
      });
      for (const f of files) {
        await deleteObject(f.objectKey);
        if (f.thumbKey) await deleteObject(f.thumbKey);
      }
      await db.auditLog.deleteMany({ where: { petId: id } });
      await db.pet.delete({ where: { id } });
    }
    await db.$disconnect();
  }
});
