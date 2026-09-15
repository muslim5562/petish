import { z } from "zod";
export const healthKinds = [
  "VISIT",
  "MEDICATION",
  "VACCINATION",
  "PROBLEM",
  "ALLERGY",
  "PROCEDURE",
  "DOCUMENT",
  "NOTE",
] as const;
export type HealthKind = (typeof healthKinds)[number];
export const kindLabels: Record<HealthKind, string> = {
  VISIT: "Vet visit",
  MEDICATION: "Medication",
  VACCINATION: "Vaccination",
  PROBLEM: "Medical problem",
  ALLERGY: "Allergy",
  PROCEDURE: "Procedure",
  DOCUMENT: "Document / photo",
  NOTE: "Other note",
};
export const sourceLabels = {
  OWNER_ENTERED: "Owner entered",
  COPIED_VET_RECORD: "Copied from vet record by owner",
  IMPORTED_DOCUMENT: "Imported document",
};
export function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function dateLabel(value: string | Date | null | undefined) {
  if (!value) return "Date not recorded";
  const date =
    typeof value === "string"
      ? value.slice(0, 10)
      : value.toISOString().slice(0, 10);
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => v || null);
const dateField = z
  .string()
  .nullish()
  .transform((v) => v || null)
  .refine(
    (v) =>
      !v ||
      (/^\d{4}-\d{2}-\d{2}$/.test(v) &&
        Number.isFinite(new Date(v + "T00:00:00Z").getTime()) &&
        new Date(v + "T00:00:00Z").toISOString().slice(0, 10) === v &&
        v >= "1900-01-01"),
    "Enter a valid calendar date.",
  );
export const healthInput = z
  .object({
    kind: z.enum(healthKinds),
    title: z
      .string()
      .trim()
      .min(1, "Add a name or a short description.")
      .max(180),
    occurredOn: dateField,
    datePrecision: z
      .enum(["EXACT", "APPROXIMATE", "UNKNOWN"])
      .default("UNKNOWN"),
    notes: optionalText(5000),
    sourceType: z
      .enum(["OWNER_ENTERED", "COPIED_VET_RECORD", "IMPORTED_DOCUMENT"])
      .default("OWNER_ENTERED"),
    sourceClinic: optionalText(160),
    linkedEncounterId: z
      .string()
      .uuid()
      .nullish()
      .transform((v) => v || null),
    version: z.number().int().positive().optional(),
    vetSaid: optionalText(3000),
    treatment: optionalText(3000),
    outcome: optionalText(3000),
    instructions: optionalText(2000),
    indication: optionalText(1000),
    startDate: dateField,
    endDate: dateField,
    status: z
      .enum(["ACTIVE", "COMPLETED", "STOPPED", "RESOLVED", "UNKNOWN"])
      .default("UNKNOWN"),
    nextDueDate: dateField,
    batch: optionalText(120),
    reaction: optionalText(2000),
    severity: z
      .enum(["UNKNOWN", "MILD", "MODERATE", "SEVERE"])
      .default("UNKNOWN"),
    major: z.boolean().default(false),
  })
  .superRefine((v, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: "custom", path: [path], message });
    if (v.datePrecision !== "UNKNOWN" && !v.occurredOn)
      issue("occurredOn", "Choose the date, or select Date unknown.");
    if (v.kind === "VISIT" && (v.datePrecision === "UNKNOWN" || !v.occurredOn))
      issue(
        "occurredOn",
        "A vet visit needs a date. An approximate date is fine.",
      );
    if (
      v.occurredOn &&
      v.datePrecision !== "UNKNOWN" &&
      v.occurredOn > todayLocal()
    )
      issue("occurredOn", "A recorded event cannot be in the future.");
    if (v.startDate && v.endDate && v.endDate < v.startDate)
      issue("endDate", "The end date cannot be before the start date.");
    if (
      v.kind === "VACCINATION" &&
      v.nextDueDate &&
      v.occurredOn &&
      v.datePrecision !== "UNKNOWN" &&
      v.nextDueDate < v.occurredOn
    )
      issue(
        "nextDueDate",
        "The next due date cannot be before the recorded vaccination.",
      );
    if (v.kind === "MEDICATION" && v.status === "RESOLVED")
      issue("status", "Choose an appropriate medication status.");
    if (
      v.kind === "PROBLEM" &&
      !["ACTIVE", "RESOLVED", "UNKNOWN"].includes(v.status)
    )
      issue("status", "Choose an appropriate problem status.");
    if (v.kind === "VISIT" && v.linkedEncounterId)
      issue(
        "linkedEncounterId",
        "A visit cannot be linked underneath another visit.",
      );
  });
export type HealthInput = z.infer<typeof healthInput>;
export const contextInput = z.object({
  emergencyNotes: optionalText(3000),
  allergyKnowledge: z.enum(["UNKNOWN", "NO_KNOWN"]).default("UNKNOWN"),
  version: z.number().int().nonnegative(),
});
export const MAX_ATTACHMENTS = 5,
  MAX_HEALTH_FILE_BYTES = 20 * 1024 * 1024,
  MAX_ACCOUNT_BYTES = 150 * 1024 * 1024;
type RecordForSummary = {
  id: string;
  title: string;
  kind: string;
  occurredOn: Date | string | null;
  updatedAt: Date | string;
  deletedAt: Date | string | null;
  medication?: { status: string; endDate: Date | string | null } | null;
  vaccination?: { nextDueDate: Date | string | null } | null;
  problem?: { status: string } | null;
  procedure?: { major: boolean } | null;
};
export function healthOverview<T extends RecordForSummary>(
  records: T[],
  petStatus: string,
  today: string,
) {
  const live = records.filter((r) => !r.deletedAt);
  const byDate = (a: T, b: T) =>
    (b.occurredOn ? new Date(b.occurredOn).getTime() : 0) -
    (a.occurredOn ? new Date(a.occurredOn).getTime() : 0);
  const medications = live.filter((r) => r.kind === "MEDICATION"),
    vaccinations = live.filter((r) => r.kind === "VACCINATION");
  const due = vaccinations
    .filter((r) => r.vaccination?.nextDueDate)
    .map((record) => {
      const date = new Date(record.vaccination!.nextDueDate!)
        .toISOString()
        .slice(0, 10);
      const days = Math.round(
        (new Date(date + "T00:00:00Z").getTime() -
          new Date(today + "T00:00:00Z").getTime()) /
          86400000,
      );
      return { record, date, days };
    })
    .filter((r) => r.days <= 30)
    .sort((a, b) => a.days - b.days);
  const review = medications.filter(
    (r) =>
      r.medication?.status === "ACTIVE" &&
      r.medication.endDate &&
      new Date(r.medication.endDate).toISOString().slice(0, 10) < today,
  );
  return {
    activeMedications: medications.filter(
      (r) => r.medication?.status === "ACTIVE",
    ),
    unknownMedications: medications.filter(
      (r) => r.medication?.status === "UNKNOWN",
    ),
    activeProblems: live.filter((r) => r.problem?.status === "ACTIVE"),
    unknownProblems: live.filter((r) => r.problem?.status === "UNKNOWN"),
    allergies: live.filter((r) => r.kind === "ALLERGY"),
    visits: live.filter((r) => r.kind === "VISIT").sort(byDate),
    procedures: live.filter((r) => r.kind === "PROCEDURE").sort(byDate),
    vaccinations: vaccinations.sort(byDate),
    missingDueDates: vaccinations.filter((r) => !r.vaccination?.nextDueDate)
      .length,
    reminders: petStatus === "ACTIVE" ? due : [],
    medicationReviews: petStatus === "ACTIVE" ? review : [],
    lastUpdated: live.length
      ? new Date(
          Math.max(...live.map((r) => new Date(r.updatedAt).getTime())),
        ).toISOString()
      : null,
  };
}
