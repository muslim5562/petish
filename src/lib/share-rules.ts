import { z } from "zod";
export const sectionNames = {
  allergies: "Allergies",
  medications: "Current medications",
  problems: "Active medical problems",
  vaccinations: "Vaccination records",
  visits: "Recent vet visits",
  procedures: "Major procedures",
  emergencyNotes: "Emergency notes",
} as const;
export type SectionKey = keyof typeof sectionNames;
export const defaultSelection = {
  petName: true,
  demographics: true,
  ownerName: false,
  microchip: false,
  freeText: true,
  clinicNames: true,
  sections: Object.keys(sectionNames) as SectionKey[],
  excludedRecordIds: [] as string[],
};
export const selectionInput = z
  .object({
    petName: z.boolean().default(true),
    demographics: z.boolean().default(true),
    ownerName: z.boolean().default(false),
    microchip: z.boolean().default(false),
    freeText: z.boolean().default(true),
    clinicNames: z.boolean().default(true),
    sections: z
      .array(
        z.enum([
          "allergies",
          "medications",
          "problems",
          "vaccinations",
          "visits",
          "procedures",
          "emergencyNotes",
        ]),
      )
      .max(7)
      .default(defaultSelection.sections),
    excludedRecordIds: z.array(z.string().uuid()).max(500).default([]),
  })
  .strict();
export type ShareSelection = z.infer<typeof selectionInput>;
export const expiryNames = {
  HOUR: "1 hour",
  DAY: "24 hours",
  WEEK: "7 days",
  UNTIL_REVOKED: "Until revoked",
} as const;
export const createShareInput = z
  .object({
    snapshotId: z.string().uuid(),
    expiry: z.enum(["HOUR", "DAY", "WEEK", "UNTIL_REVOKED"]).default("DAY"),
    confirmBearer: z.literal(true, {
      error:
        "Confirm that you reviewed this snapshot and understand who can view the link.",
    }),
    confirmNoExpiry: z.boolean().default(false),
  })
  .strict()
  .refine((v) => v.expiry !== "UNTIL_REVOKED" || v.confirmNoExpiry, {
    message: "Explicitly confirm that this link will have no automatic expiry.",
    path: ["confirmNoExpiry"],
  });
export type SnapshotField = { label: string; value: string };
export type SnapshotItem = { title: string; fields: SnapshotField[] };
export type SnapshotSection = {
  key: SectionKey;
  title: string;
  note: string;
  items: SnapshotItem[];
};
export type SummaryContent = {
  version: 1;
  heading: string;
  capturedAt: string;
  lastUpdated: string | null;
  identity: SnapshotField[];
  sections: SnapshotSection[];
  provenance: string;
  omissionNotice: string;
};
export function shareStatus(
  share: { revokedAt: Date | string | null; expiresAt: Date | string | null },
  now = new Date(),
) {
  return share.revokedAt
    ? "Revoked"
    : share.expiresAt && new Date(share.expiresAt) <= now
      ? "Expired"
      : "Active";
}
