import "dotenv/config";
import { readFile } from "node:fs/promises";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { db } from "../src/lib/db";
import { saveHealthRecord } from "../src/lib/health";
import { addHealthFile } from "../src/lib/health-files";
if (process.env.PETISH_DEMO !== "true")
  throw new Error("Health seeding is demo-only.");
const owner = await db.user.findUnique({
  where: { email: "sarah@petish.test" },
});
const pet = owner
  ? await db.pet.findFirst({ where: { ownerId: owner.id, name: "Milo" } })
  : null;
if (owner && pet) {
  const marker = "Seeded fictional Phase 2 demo history";
  if (
    !(await db.auditLog.findFirst({ where: { petId: pet.id, action: marker } }))
  ) {
    const entries = [
      {
        kind: "VISIT",
        title: "First puppy check — demo",
        occurredOn: "2021-08-12",
        vetSaid: "Fictional visit: settling in well.",
        outcome: "Settled into the new home.",
      },
      {
        kind: "PROCEDURE",
        title: "Neutering — demo",
        occurredOn: "2022-03-10",
        major: true,
        outcome: "Fictional record: recovery completed.",
      },
      {
        kind: "VISIT",
        title: "Itchy skin consultation — demo",
        occurredOn: "2024-05-18",
        vetSaid: "Fictional example of a recurring skin complaint.",
        treatment: "Follow the actual vet’s written instructions.",
        outcome: "Owner recorded improvement at follow-up.",
      },
      {
        kind: "PROBLEM",
        title: "Recurring skin irritation — demo",
        occurredOn: "2024-05-18",
        status: "ACTIVE",
        notes:
          "Fictional chronic problem used to demonstrate an ongoing record.",
      },
      {
        kind: "ALLERGY",
        title: "Reported shampoo sensitivity — demo",
        occurredOn: "2024-05-18",
        reaction: "Owner noted redness after a new shampoo. Fictional example.",
        severity: "UNKNOWN",
      },
      {
        kind: "VISIT",
        title: "Annual wellbeing visit — demo",
        occurredOn: "2026-06-05",
        vetSaid: "Fictional check-in for this demonstration.",
        outcome: "Owner monitoring notes at home.",
      },
      {
        kind: "VACCINATION",
        title: "Vaccination entry — demo",
        occurredOn: "2026-06-05",
        nextDueDate: new Date(Date.now() + 10 * 86400000)
          .toISOString()
          .slice(0, 10),
        notes:
          "The next due date was explicitly entered for this fictional demo. It is not a recommended schedule.",
      },
      {
        kind: "MEDICATION",
        title: "Skin prescription — fictional example",
        occurredOn: "2026-06-05",
        status: "ACTIVE",
        instructions:
          "Demo only. No medicine or dose is specified. Refer to your own vet’s prescription.",
        indication: "Demonstrates a medication marked active by the owner.",
      },
      {
        kind: "DOCUMENT",
        title: "Visit report — fictional example",
        occurredOn: "2026-06-05",
        sourceType: "IMPORTED_DOCUMENT",
      },
      {
        kind: "NOTE",
        title: "A detail to ask about next time — demo",
        datePrecision: "UNKNOWN",
        notes:
          "Fictional owner note: remember to bring earlier reports. Exact date unknown.",
      },
    ];
    let latestVisit: string | undefined;
    for (const input of entries) {
      let record = await db.healthRecord.findFirst({
        where: { petId: pet.id, title: input.title },
      });
      if (!record)
        record = await saveHealthRecord(owner.id, pet.id, {
          datePrecision: "EXACT",
          sourceClinic: "Fictional demo clinic",
          ...input,
          ...(["MEDICATION", "DOCUMENT", "VACCINATION"].includes(input.kind) &&
          latestVisit
            ? { linkedEncounterId: latestVisit }
            : {}),
        });
      if (input.kind === "VISIT") latestVisit = record.id;
      if (
        input.kind === "DOCUMENT" &&
        !(await db.attachment.count({ where: { recordId: record.id } }))
      ) {
        const pdf = await PDFDocument.create();
        const page = pdf.addPage([595, 842]);
        const font = await pdf.embedFont(StandardFonts.Helvetica);
        const lines = [
          "PETISH / FICTIONAL DEMO REPORT",
          "Milo - 5 June 2026",
          "This is synthetic demonstration data, not a medical report.",
          "",
          "Visit: annual wellbeing check-in",
          "Owner notes: earlier history reviewed.",
          "Outcome: owner monitoring notes at home.",
          "",
          "No clinical findings, medicines, doses, or treatment advice are provided.",
          "This file demonstrates private PDF attachments in Petish.",
        ];
        lines.forEach((line, i) =>
          page.drawText(line, {
            x: 45,
            y: 780 - i * 28,
            size: i === 0 ? 18 : 11,
            font,
            color: rgb(0.13, 0.25, 0.22),
          }),
        );
        await addHealthFile(
          owner.id,
          pet.id,
          record.id,
          new File(
            [new Uint8Array(await pdf.save())],
            "fictional-visit-report.pdf",
            { type: "application/pdf" },
          ),
          "Fictional visit report — demo only",
        );
      }
    }
    await db.auditLog.create({
      data: { actorId: owner.id, petId: pet.id, action: marker },
    });
  }
}
if (owner && pet) {
  const photoMarker = "Seeded fictional medication photo";
  const med = await db.healthRecord.findFirst({
    where: {
      petId: pet.id,
      title: "Skin prescription — fictional example",
      deletedAt: null,
    },
  });
  if (
    med &&
    !(await db.auditLog.findFirst({
      where: { petId: pet.id, action: photoMarker },
    }))
  ) {
    if (!(await db.attachment.count({ where: { recordId: med.id } })))
      await addHealthFile(
        owner.id,
        pet.id,
        med.id,
        new File(
          [
            new Uint8Array(
              await readFile("public/demo/fictional-medication.png"),
            ),
          ],
          "fictional-medication.png",
          { type: "image/png" },
        ),
        "AI-generated fictional packaging — not a real medicine",
      );
    await db.auditLog.create({
      data: { actorId: owner.id, petId: pet.id, action: photoMarker },
    });
  }
}
console.log("Fictional health demo history ready; existing entries preserved.");
await db.$disconnect();
