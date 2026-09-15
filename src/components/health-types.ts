import type { HealthKind, healthOverview } from "@/lib/health-rules";
export type HealthFile = {
  id: string;
  filename: string;
  description: string | null;
  mime: string;
  bytes: number;
  createdAt: string;
};
export type HealthEntry = {
  id: string;
  petId: string;
  kind: HealthKind;
  title: string;
  occurredOn: string | null;
  datePrecision: "EXACT" | "APPROXIMATE" | "UNKNOWN";
  notes: string | null;
  sourceType: "OWNER_ENTERED" | "COPIED_VET_RECORD" | "IMPORTED_DOCUMENT";
  sourceClinic: string | null;
  enteredBy: string;
  updatedBy: string;
  linkedEncounterId: string | null;
  version: number;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  encounter: {
    vetSaid: string | null;
    treatment: string | null;
    outcome: string | null;
  } | null;
  medication: {
    instructions: string | null;
    indication: string | null;
    startDate: string | null;
    endDate: string | null;
    status: string;
  } | null;
  vaccination: { nextDueDate: string | null; batch: string | null } | null;
  problem: { status: string } | null;
  allergy: { reaction: string | null; severity: string } | null;
  procedure: { outcome: string | null; major: boolean } | null;
  attachments: HealthFile[];
};
export type HealthContext = {
  petId: string;
  emergencyNotes: string | null;
  allergyKnowledge: string;
  version: number;
  updatedAt: string;
};
export type HealthPayload = {
  records: HealthEntry[];
  context: HealthContext | null;
  overview: ReturnType<typeof healthOverview<HealthEntry>>;
};
export type HealthPet = {
  id: string;
  name: string;
  species: string;
  breed: string | null;
  sex: string;
  birthDate: string | null;
  birthPrecision: string;
  microchip: string | null;
  mainImageId: string | null;
  status: string;
};
export async function healthApi(url: string, method = "GET", body?: unknown) {
  const r = await fetch(url, {
    method,
    headers:
      body instanceof FormData
        ? undefined
        : { "Content-Type": "application/json" },
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
  }).catch(() => {
    throw new Error(
      "Could not reach Petish. Reconnect and retry. If a save was interrupted, check the record before adding it again.",
    );
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "Please try again.");
  return data;
}
