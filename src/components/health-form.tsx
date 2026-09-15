"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  LockKeyhole,
  Camera,
  Paperclip,
  LoaderCircle,
} from "lucide-react";
import {
  dateLabel,
  kindLabels,
  sourceLabels,
  todayLocal,
  type HealthKind,
} from "@/lib/health-rules";
import { healthApi, type HealthEntry, type HealthPet } from "./health-types";
export default function HealthForm({
  pet,
  kind,
  record,
  visits,
  onSaved,
  linkedVisit,
}: {
  pet: HealthPet;
  kind: HealthKind;
  record?: HealthEntry;
  visits: HealthEntry[];
  onSaved: (record: HealthEntry) => Promise<void>;
  linkedVisit?: string;
}) {
  const base = `/app/pets/${pet.id}/health`;
  const [precision, setPrecision] = useState(record?.datePrecision || "EXACT"),
    [date, setDate] = useState(
      record?.occurredOn?.slice(0, 10) || todayLocal(),
    ),
    [files, setFiles] = useState<File[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState<HealthEntry | null>(null);
  const titleLabels: Record<HealthKind, string> = {
    VISIT: "Reason for the visit",
    MEDICATION: "Medication name or description",
    VACCINATION: "Vaccination name",
    PROBLEM: "Problem or concern",
    ALLERGY: "Allergen or suspected trigger",
    PROCEDURE: "Procedure name",
    DOCUMENT: "Document title",
    NOTE: "A short title",
  };
  const placeholders: Record<HealthKind, string> = {
    VISIT: "e.g. Not eating and vomiting",
    MEDICATION: "e.g. Name on the prescription label",
    VACCINATION: "e.g. Name on the vaccination card",
    PROBLEM: "e.g. Recurring itchy skin",
    ALLERGY: "e.g. Reaction noted after a medication",
    PROCEDURE: "e.g. Dental cleaning",
    DOCUMENT: "e.g. Blood test report from August",
    NOTE: "e.g. Something to mention at the next visit",
  };
  function pick(selected: FileList | null) {
    if (!selected) return;
    const next = Array.from(selected);
    if (next.some((f) => f.size > 20 * 1024 * 1024)) {
      setError("Choose files up to 20 MB each.");
      return;
    }
    if (next.length + (record?.attachments.length || 0) > 5) {
      setError("An entry can hold up to five files.");
      return;
    }
    setFiles(next);
    setError("");
  }
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const values = Object.fromEntries(
        new FormData(e.currentTarget).entries(),
      );
      const input = {
        ...values,
        kind,
        datePrecision: precision,
        occurredOn: precision === "UNKNOWN" ? null : date,
        version: saved?.version || record?.version,
        linkedEncounterId: values.linkedEncounterId || null,
        major: values.major === "on",
      };
      const existing = saved?.id || record?.id;
      let result: HealthEntry = await healthApi(
        `/api/health/${pet.id}${existing ? `/${existing}` : ""}`,
        existing ? "PATCH" : "POST",
        input,
      );
      setSaved(result);
      for (let i = 0; i < files.length; i++) {
        const body = new FormData();
        body.set("file", files[i]);
        body.set("description", String(values.fileDescription || ""));
        try {
          result = await healthApi(
            `/api/health/${pet.id}/${result.id}/files`,
            "POST",
            body,
          );
          setSaved(result);
        } catch (e) {
          setFiles(files.slice(i));
          throw e;
        }
      }
      setFiles([]);
      await onSaved(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="form-page health-form-page">
      <Link className="back-link" href={record ? `${base}/${record.id}` : base}>
        <ArrowLeft size={17} />{" "}
        {record ? "Back to record" : `${pet.name}’s health`}
      </Link>
      <span className="eyebrow">
        {record
          ? "KEEPING THE STORY ACCURATE"
          : "ONE SMALL NOTE, A LITTLE MORE CONTEXT"}
      </span>
      <h1>
        {record ? "Edit" : "Add"} {kindLabels[kind].toLowerCase()}.
      </h1>
      <p className="muted">
        {kind === "VISIT"
          ? "A date and a short reason are enough. Add treatment and outcome whenever you know them."
          : "Start with a name or description. Everything else can be added later."}
      </p>
      <form className="pet-form" onSubmit={save}>
        <label>
          {titleLabels[kind]} <span className="required">*</span>
          <input
            name="title"
            defaultValue={record?.title || ""}
            required
            maxLength={180}
            placeholder={placeholders[kind]}
            autoFocus
          />
        </label>
        <div className="form-grid">
          <label>
            Date information
            <select
              value={precision}
              onChange={(e) => setPrecision(e.target.value as typeof precision)}
            >
              <option value="EXACT">Exact date</option>
              <option value="APPROXIMATE">Approximate date</option>
              {kind !== "VISIT" && (
                <option value="UNKNOWN">Date unknown</option>
              )}
            </select>
          </label>
          {precision !== "UNKNOWN" && (
            <label>
              {precision === "APPROXIMATE"
                ? "Approximate event date"
                : "Event date"}
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min="1900-01-01"
                max={todayLocal()}
                required
              />
            </label>
          )}
        </div>
        {kind === "VISIT" && (
          <>
            <label>
              What did the vet say? <small>Optional</small>
              <textarea
                name="vetSaid"
                rows={2}
                maxLength={3000}
                defaultValue={record?.encounter?.vetSaid || ""}
              />
            </label>
            <label>
              Treatment or advice <small>Optional</small>
              <textarea
                name="treatment"
                rows={2}
                maxLength={3000}
                defaultValue={record?.encounter?.treatment || ""}
              />
            </label>
            <label>
              Outcome <small>Can be added later</small>
              <textarea
                name="outcome"
                rows={2}
                maxLength={3000}
                defaultValue={record?.encounter?.outcome || ""}
                placeholder="e.g. Appetite improved after two days"
              />
            </label>
          </>
        )}
        {kind === "MEDICATION" && (
          <>
            <label>
              Instructions from the prescription <small>Optional</small>
              <textarea
                name="instructions"
                rows={2}
                maxLength={2000}
                defaultValue={record?.medication?.instructions || ""}
                placeholder="Copy the label or the vet’s instructions as written."
              />
            </label>
            <label>
              What was it for? <small>Optional</small>
              <input
                name="indication"
                maxLength={1000}
                defaultValue={record?.medication?.indication || ""}
              />
            </label>
            <label>
              Medication status
              <select
                name="status"
                defaultValue={record?.medication?.status || "UNKNOWN"}
              >
                <option value="UNKNOWN">Unknown / not recorded</option>
                <option value="ACTIVE">Active</option>
                <option value="COMPLETED">Completed</option>
                <option value="STOPPED">Stopped</option>
              </select>
            </label>
            <div className="form-grid">
              <label>
                Start date <small>Optional</small>
                <input
                  type="date"
                  name="startDate"
                  defaultValue={
                    record?.medication?.startDate?.slice(0, 10) || ""
                  }
                />
              </label>
              <label>
                End date <small>Optional</small>
                <input
                  type="date"
                  name="endDate"
                  defaultValue={record?.medication?.endDate?.slice(0, 10) || ""}
                />
              </label>
            </div>
            <p className="fine-print">
              Dates do not automatically change the status or provide dosing
              advice.
            </p>
          </>
        )}
        {kind === "VACCINATION" && (
          <>
            <label>
              Next due date <small>Optional</small>
              <input
                type="date"
                name="nextDueDate"
                defaultValue={
                  record?.vaccination?.nextDueDate?.slice(0, 10) || ""
                }
              />
              <small>
                Copy an explicit date from the vet or vaccination card. This
                date creates the reminder.
              </small>
            </label>
            <label>
              Batch or reference <small>Optional</small>
              <input
                name="batch"
                defaultValue={record?.vaccination?.batch || ""}
                maxLength={120}
              />
            </label>
          </>
        )}
        {kind === "PROBLEM" && (
          <label>
            Problem status
            <select
              name="status"
              defaultValue={record?.problem?.status || "UNKNOWN"}
            >
              <option value="UNKNOWN">Unknown / not recorded</option>
              <option value="ACTIVE">Active</option>
              <option value="RESOLVED">Resolved</option>
            </select>
          </label>
        )}
        {kind === "ALLERGY" && (
          <>
            <label>
              Observed reaction <small>Optional</small>
              <textarea
                rows={3}
                name="reaction"
                maxLength={2000}
                defaultValue={record?.allergy?.reaction || ""}
              />
            </label>
            <label>
              Severity as recorded
              <select
                name="severity"
                defaultValue={record?.allergy?.severity || "UNKNOWN"}
              >
                <option value="UNKNOWN">Unknown / not recorded</option>
                <option value="MILD">Mild</option>
                <option value="MODERATE">Moderate</option>
                <option value="SEVERE">Severe</option>
              </select>
            </label>
            <p className="fine-print">
              An owner-entered allergy is not a veterinary verification.
            </p>
          </>
        )}
        {kind === "PROCEDURE" && (
          <>
            <label>
              Outcome <small>Optional</small>
              <textarea
                rows={2}
                name="outcome"
                maxLength={3000}
                defaultValue={record?.procedure?.outcome || ""}
              />
            </label>
            <label className="checkbox-label">
              <input
                name="major"
                type="checkbox"
                defaultChecked={record?.procedure?.major || false}
              />
              Include as a major procedure in the summary
            </label>
          </>
        )}
        <label>
          {kind === "NOTE" ? "Your note" : "Notes"} <small>Optional</small>
          <textarea
            name="notes"
            rows={kind === "NOTE" ? 5 : 2}
            maxLength={5000}
            defaultValue={record?.notes || ""}
          />
        </label>
        <details
          className="optional-details"
          open={
            !!record?.sourceClinic ||
            (record?.sourceType !== "OWNER_ENTERED" && !!record)
          }
        >
          <summary>
            Source and visit <span>Optional details</span>
          </summary>
          <label>
            Where did this information come from?
            <select
              name="sourceType"
              defaultValue={record?.sourceType || "OWNER_ENTERED"}
            >
              {Object.entries(sourceLabels).map(([v, l]) => (
                <option value={v} key={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label>
            Vet or clinic
            <input
              name="sourceClinic"
              maxLength={160}
              defaultValue={record?.sourceClinic || ""}
              placeholder="Clinic name, if known"
            />
          </label>
          {kind !== "VISIT" && (
            <label>
              Related vet visit
              <select
                name="linkedEncounterId"
                defaultValue={record?.linkedEncounterId || linkedVisit || ""}
              >
                <option value="">Not linked to a visit</option>
                {visits
                  .filter((v) => !v.deletedAt)
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {dateLabel(v.occurredOn)} · {v.title}
                    </option>
                  ))}
              </select>
            </label>
          )}
        </details>
        <div className="health-upload">
          <strong>
            <Paperclip size={17} />{" "}
            {kind === "MEDICATION"
              ? "Packaging, label, or prescription"
              : "Supporting files"}
          </strong>
          <p className="fine-print">
            Optional · up to 5 files per entry · 20 MB each · JPEG, PNG, WebP or
            PDF.
          </p>
          <div className="button-row">
            <label className="button secondary">
              Choose files
              <input
                className="sr-only"
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) => pick(e.target.files)}
                disabled={busy}
              />
            </label>
            <label className="button secondary">
              <Camera size={17} /> Take photo
              <input
                className="sr-only"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                onChange={(e) => pick(e.target.files)}
                disabled={busy}
              />
            </label>
          </div>
          {record?.attachments.length ? (
            <p className="fine-print">
              {record.attachments.length} existing file(s). Manage them from the
              record page.
            </p>
          ) : null}
          {files.length > 0 && (
            <>
              <ul className="picked-files">
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`}>{f.name}</li>
                ))}
              </ul>
              <button
                type="button"
                className="text-button"
                onClick={() => setFiles([])}
              >
                Clear selected files
              </button>
              <label>
                File description <small>Optional</small>
                <input
                  name="fileDescription"
                  maxLength={300}
                  placeholder="e.g. Prescription label from this visit"
                />
              </label>
            </>
          )}
        </div>
        <p className="form-privacy">
          <LockKeyhole size={17} />
          Health records and files always stay private.
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
            {saved
              ? " Your entry is saved; remaining files can be retried without creating another record."
              : ""}
          </p>
        )}
        <div className="form-actions">
          <Link
            href={saved ? `${base}/${saved.id}` : base}
            className="button secondary"
          >
            {saved ? "Open saved entry" : "Cancel"}
          </Link>
          <button className="button primary" disabled={busy}>
            {busy ? (
              <>
                <LoaderCircle size={17} className="spin" /> Saving…
              </>
            ) : (
              <>
                {record || saved ? "Save changes" : "Save record"}
                <ArrowUpRight size={17} />
              </>
            )}
          </button>
        </div>
      </form>
    </section>
  );
}
