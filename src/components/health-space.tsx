"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  Check,
  ClipboardList,
  FileText,
  Heart,
  History,
  Hospital,
  Info,
  LockKeyhole,
  Maximize2,
  Paperclip,
  Pill,
  Plus,
  Search,
  ShieldAlert,
  Stethoscope,
  Syringe,
  X,
} from "lucide-react";
import { ageLabel } from "@/lib/pet-rules";
import {
  dateLabel,
  healthKinds,
  kindLabels,
  sourceLabels,
  todayLocal,
  type HealthKind,
} from "@/lib/health-rules";
import {
  healthApi,
  type HealthEntry,
  type HealthPet,
  type HealthPayload,
  type HealthContext,
} from "./health-types";
import ShareManager from "./share-manager";
import HealthForm from "./health-form";
const icons = {
  VISIT: Stethoscope,
  MEDICATION: Pill,
  VACCINATION: Syringe,
  PROBLEM: Activity,
  ALLERGY: ShieldAlert,
  PROCEDURE: Hospital,
  DOCUMENT: FileText,
  NOTE: ClipboardList,
};
const dateText = (r: HealthEntry) =>
  `${r.datePrecision === "APPROXIMATE" ? "Around " : ""}${dateLabel(r.occurredOn)}`;
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="health-empty">{children}</p>;
}
function RecordFields({ record: r }: { record: HealthEntry }) {
  const fields: [string, string | null | undefined][] = [
    ["Notes", r.notes],
    ["Vet said", r.encounter?.vetSaid],
    ["Treatment or advice", r.encounter?.treatment],
    ["Outcome", r.encounter?.outcome || r.procedure?.outcome],
    ["Prescription instructions", r.medication?.instructions],
    ["What it was for", r.medication?.indication],
    ["Medication status", r.medication?.status],
    [
      "Start date",
      r.medication?.startDate ? dateLabel(r.medication.startDate) : null,
    ],
    [
      "End date",
      r.medication?.endDate ? dateLabel(r.medication.endDate) : null,
    ],
    [
      "Next vaccination due",
      r.kind === "VACCINATION"
        ? r.vaccination?.nextDueDate
          ? dateLabel(r.vaccination.nextDueDate)
          : "Not recorded"
        : null,
    ],
    ["Batch or reference", r.vaccination?.batch],
    ["Problem status", r.problem?.status],
    ["Reaction", r.allergy?.reaction],
    ["Allergy severity", r.allergy?.severity],
    ["Major procedure", r.procedure?.major ? "Yes" : null],
  ];
  return (
    <dl className="health-facts">
      {fields
        .filter(([, v]) => v)
        .map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>
              {v === "UNKNOWN"
                ? "Unknown / not recorded"
                : v === "ACTIVE"
                  ? "Active"
                  : v === "COMPLETED"
                    ? "Completed"
                    : v === "STOPPED"
                      ? "Stopped"
                      : v === "RESOLVED"
                        ? "Resolved"
                        : v}
            </dd>
          </div>
        ))}
    </dl>
  );
}
function TimelineRow({ r, base }: { r: HealthEntry; base: string }) {
  const Icon = icons[r.kind];
  return (
    <Link
      href={`${base}/${r.id}`}
      className={`timeline-row kind-${r.kind.toLowerCase()}`}
    >
      <span className="timeline-icon">
        <Icon size={21} />
      </span>
      <div>
        <div className="timeline-meta">
          <span>{kindLabels[r.kind]}</span>
          <time>{dateText(r)}</time>
        </div>
        <h3>{r.title}</h3>
        <p>
          {r.encounter?.outcome
            ? `Outcome: ${r.encounter.outcome}`
            : r.medication
              ? `${r.medication.status === "UNKNOWN" ? "Status unknown" : r.medication.status.toLowerCase()}${r.medication.instructions ? ` · ${r.medication.instructions}` : ""}`
              : r.problem
                ? `Status: ${r.problem.status.toLowerCase()}`
                : r.sourceClinic || r.notes || "Owner-controlled health record"}
        </p>
        {r.attachments.length > 0 && (
          <span className="file-count">
            <Paperclip size={13} />
            {r.attachments.length} file{r.attachments.length !== 1 ? "s" : ""}
          </span>
        )}
        {r.linkedEncounterId && (
          <span className="file-count">Linked to a vet visit</span>
        )}
        {r.deletedAt && (
          <span className="removed-label">Removed from normal views</span>
        )}
      </div>
      <ArrowUpRight size={17} />
    </Link>
  );
}
export default function HealthSpace({
  pet,
  ownerId,
  ownerName,
  path,
}: {
  pet: HealthPet;
  ownerId: string;
  ownerName: string;
  path: string[];
}) {
  const router = useRouter(),
    pathname = usePathname(),
    query = useSearchParams(),
    base = `/app/pets/${pet.id}/health`;
  const [data, setData] = useState<HealthPayload | null>(null),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(false),
    [filter, setFilter] = useState("ALL"),
    [search, setSearch] = useState(""),
    [revisions, setRevisions] = useState<
      | {
          id: string;
          version: number;
          action: string;
          actorId: string;
          createdAt: string;
          snapshot: HealthEntry;
        }[]
      | null
    >(null),
    [contextEditor, setContextEditor] = useState(false),
    [focused, setFocused] = useState(false);
  const view = path[0] || "overview";
  const kind = healthKinds.includes(query.get("kind") as HealthKind)
    ? (query.get("kind") as HealthKind)
    : null;
  const record = data?.records.find((r) => r.id === view);
  async function refresh() {
    const result = await healthApi(
      `/api/health/${pet.id}?today=${todayLocal()}`,
    );
    setData(result);
    return result as HealthPayload;
  }
  useEffect(() => {
    let active = true;
    setRevisions(null);
    healthApi(`/api/health/${pet.id}?today=${todayLocal()}`)
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [pet.id, pathname]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(id);
  }, [toast]);
  async function act(fn: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError("");
    try {
      await fn();
      await refresh();
      setToast(message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!data)
    return (
      <section className="health-space">
        <p className="loading" role="status">
          Getting {pet.name}’s health record…
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </section>
    );
  if (view === "shares")
    return (
      <ShareManager
        key={path.join("/")}
        pet={pet}
        data={data}
        create={path[1] === "new"}
      />
    );
  const live = data.records.filter((r) => !r.deletedAt),
    o = data.overview;
  const visits = data.records.filter((r) => r.kind === "VISIT" && !r.deletedAt);
  const related = record?.linkedEncounterId
    ? data.records.find((r) => r.id === record.linkedEncounterId)
    : null;
  const effectiveFilter =
    filter === "ALL" && healthKinds.includes(query.get("type") as HealthKind)
      ? query.get("type")!
      : filter;
  const items = data.records.filter(
    (r) =>
      (effectiveFilter === "REMOVED"
        ? !!r.deletedAt
        : !r.deletedAt &&
          (effectiveFilter === "ALL" || r.kind === effectiveFilter)) &&
      `${r.title} ${r.notes || ""} ${r.sourceClinic || ""}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  if (
    (view === "new" && kind) ||
    (record && path[1] === "edit" && !record.deletedAt)
  )
    return (
      <HealthForm
        key={record?.id || kind}
        pet={pet}
        kind={record?.kind || kind!}
        record={record}
        visits={visits}
        linkedVisit={query.get("visit") || undefined}
        onSaved={async (r) => {
          await refresh();
          router.push(`${base}/${r.id}`);
          setToast("Health record saved.");
        }}
      />
    );
  return (
    <section className={`health-space ${focused ? "health-focus" : ""}`}>
      {focused ? (
        <button className="button secondary" onClick={() => setFocused(false)}>
          <X size={18} /> Exit full-screen summary
        </button>
      ) : (
        <Link className="back-link" href={`/app/pets/${pet.id}`}>
          <ArrowLeft size={17} /> {pet.name}’s profile
        </Link>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {toast && (
        <p className="success" role="status">
          <Check size={17} />
          {toast}
        </p>
      )}
      <div className="page-heading health-heading">
        <div>
          <span className="eyebrow">
            <LockKeyhole size={14} /> ONLY YOU CAN SEE THIS
          </span>
          <h1>
            {view === "summary" ? "Health summary" : `${pet.name}’s health`}
            <span className="heading-dot">.</span>
          </h1>
          <p>
            {view === "summary"
              ? "A concise view to show your vet."
              : "Their story, one small note at a time."}
          </p>
        </div>
        {view !== "new" && !focused && (
          <Link href={`${base}/new`} className="button primary">
            <Plus size={18} /> Add health record
          </Link>
        )}
      </div>
      {!focused && (
        <nav className="health-nav" aria-label="Pet health navigation">
          {[
            ["overview", "Overview"],
            ["timeline", "Timeline"],
            ["documents", "Documents"],
            ["summary", "Summary"],
            ["shares", "Shared links"],
          ].map(([v, l]) => (
            <Link
              key={v}
              href={v === "overview" ? base : `${base}/${v}`}
              className={view === v ? "active" : ""}
            >
              {l}
            </Link>
          ))}
        </nav>
      )}
      {view === "new" ? (
        <>
          <h2 className="health-section-title">What would you like to add?</h2>
          <p className="muted">
            Choose one. We’ll ask only for the relevant details.
          </p>
          <div className="entry-choices">
            {healthKinds.map((k) => {
              const Icon = icons[k];
              return (
                <Link
                  key={k}
                  href={`${base}/new?kind=${k}${query.get("visit") ? `&visit=${query.get("visit")}` : ""}`}
                >
                  <span className={`timeline-icon kind-${k.toLowerCase()}`}>
                    <Icon size={24} />
                  </span>
                  <strong>{kindLabels[k]}</strong>
                  <ArrowUpRight size={18} />
                </Link>
              );
            })}
          </div>
        </>
      ) : view === "summary" ? (
        <>
          {!focused && (
            <div className="summary-control">
              <Link className="button primary" href={`${base}/shares/new`}>
                Share selected summary <ArrowUpRight size={17} />
              </Link>
              <span>
                <Info size={16} /> Live owner-only view. No shareable health
                link is created.
              </span>
              <button
                className="button secondary"
                onClick={() => setFocused(true)}
              >
                <Maximize2 size={17} /> Show on screen
              </button>
            </div>
          )}
          <div className="summary-identity">
            {pet.mainImageId && (
              <img
                src={`/api/images/${pet.mainImageId}?size=thumb`}
                alt={pet.name}
              />
            )}
            <div>
              <h2>{pet.name}</h2>
              <p>
                {pet.breed || (pet.species === "DOG" ? "Dog" : "Cat")} ·{" "}
                {ageLabel(pet.birthDate, pet.birthPrecision)} ·{" "}
                {pet.sex === "UNKNOWN"
                  ? "Sex unknown"
                  : pet.sex === "MALE"
                    ? "Male"
                    : "Female"}
              </p>
              <p>
                Current custodian: {ownerName}
                {pet.microchip ? ` · Microchip: ${pet.microchip}` : ""}
              </p>
            </div>
          </div>
          <p className="summary-provenance">
            Owner-maintained information, not veterinarian-verified. Updated{" "}
            {o.lastUpdated || data.context?.updatedAt
              ? dateLabel(
                  new Date(
                    Math.max(
                      new Date(o.lastUpdated || 0).getTime(),
                      new Date(data.context?.updatedAt || 0).getTime(),
                    ),
                  ),
                )
              : "Not yet recorded"}
            .
          </p>
          <section className="summary-block important">
            <h2>
              <ShieldAlert size={20} /> Allergies
            </h2>
            {o.allergies.length ? (
              o.allergies.map((r) => (
                <article key={r.id}>
                  <h3>{r.title}</h3>
                  <p>
                    {r.allergy?.reaction || "Reaction not recorded"} · Severity:{" "}
                    {r.allergy?.severity?.toLowerCase() || "unknown"}
                  </p>
                </article>
              ))
            ) : (
              <p>
                {data.context?.allergyKnowledge === "NO_KNOWN"
                  ? "No known allergies — reported by owner."
                  : "No allergies recorded. Whether allergies are present is unknown."}
              </p>
            )}
          </section>
          {data.context?.emergencyNotes && (
            <section className="summary-block important">
              <h2>Emergency notes</h2>
              <p className="preserve-lines">{data.context.emergencyNotes}</p>
            </section>
          )}
          <section className="summary-block">
            <h2>
              <Pill size={20} /> Current medications
            </h2>
            {o.activeMedications.length ? (
              o.activeMedications.map((r) => (
                <article key={r.id}>
                  <h3>{r.title}</h3>
                  <p>
                    {r.medication?.instructions || "Instructions not recorded"}
                  </p>
                  <p>{r.medication?.indication || ""}</p>
                  <small>
                    Marked active by owner
                    {r.medication?.endDate
                      ? ` · recorded end date ${dateLabel(r.medication.endDate)}`
                      : ""}
                  </small>
                </article>
              ))
            ) : (
              <Empty>No medications are marked active in this record.</Empty>
            )}
            {o.unknownMedications.length > 0 && (
              <div className="summary-unknown">
                <strong>Status unknown</strong>
                {o.unknownMedications.map((r) => (
                  <p key={r.id}>
                    {r.title} ·{" "}
                    {r.medication?.instructions || "Instructions not recorded"}
                  </p>
                ))}
              </div>
            )}
          </section>
          <section className="summary-block">
            <h2>
              <Activity size={20} /> Active medical problems
            </h2>
            {o.activeProblems.length ? (
              o.activeProblems.map((r) => (
                <article key={r.id}>
                  <h3>{r.title}</h3>
                  {r.notes && <p>{r.notes}</p>}
                </article>
              ))
            ) : (
              <Empty>No problems are marked active in this record.</Empty>
            )}
            {o.unknownProblems.length > 0 && (
              <div className="summary-unknown">
                <strong>Status unknown</strong>
                {o.unknownProblems.map((r) => (
                  <p key={r.id}>{r.title}</p>
                ))}
              </div>
            )}
          </section>
          <section className="summary-block">
            <h2>
              <Syringe size={20} /> Vaccination records
            </h2>
            {o.vaccinations.length ? (
              o.vaccinations.slice(0, 6).map((r) => (
                <article key={r.id}>
                  <h3>{r.title}</h3>
                  <p>
                    {dateText(r)} ·{" "}
                    {r.vaccination?.nextDueDate
                      ? `Next due ${dateLabel(r.vaccination.nextDueDate)}`
                      : "Next due date not recorded"}
                  </p>
                </article>
              ))
            ) : (
              <Empty>
                No vaccinations recorded. Vaccination status is unknown.
              </Empty>
            )}
            <p className="fine-print">
              This lists entered records, not a clinical assessment of
              vaccination coverage.
            </p>
          </section>
          <section className="summary-block">
            <h2>
              <Stethoscope size={20} /> Recent vet visits
            </h2>
            {o.visits.length ? (
              o.visits.slice(0, 3).map((r) => (
                <article key={r.id}>
                  <h3>{r.title}</h3>
                  <p>
                    {dateText(r)}
                    {r.sourceClinic ? ` · ${r.sourceClinic}` : ""}
                  </p>
                  {r.encounter?.vetSaid && (
                    <p>Vet said: {r.encounter.vetSaid}</p>
                  )}
                  {r.encounter?.treatment && (
                    <p>Treatment: {r.encounter.treatment}</p>
                  )}
                  <p>Outcome: {r.encounter?.outcome || "Not recorded"}</p>
                </article>
              ))
            ) : (
              <Empty>No vet visits recorded.</Empty>
            )}
          </section>
          <section className="summary-block">
            <h2>Major procedures</h2>
            {o.procedures.some((r) => r.procedure?.major) ? (
              o.procedures
                .filter((r) => r.procedure?.major)
                .slice(0, 5)
                .map((r) => (
                  <article key={r.id}>
                    <h3>{r.title}</h3>
                    <p>
                      {dateText(r)} ·{" "}
                      {r.procedure?.outcome || "Outcome not recorded"}
                    </p>
                  </article>
                ))
            ) : (
              <Empty>No major procedures recorded.</Empty>
            )}
          </section>
          <p className="fine-print">
            This summary shows active and unknown-status items, six recent
            vaccination entries, three recent visits, and five major procedures.
            The full timeline remains available to you.
          </p>
        </>
      ) : view === "overview" ? (
        <>
          <div className="health-stats">
            <Link href={`${base}/timeline?type=MEDICATION`}>
              <span className="stat-icon">
                <Pill size={22} />
              </span>
              <strong>{o.activeMedications.length}</strong>
              <span>Marked active medications</span>
              <small>
                {o.unknownMedications.length
                  ? `${o.unknownMedications.length} with status unknown`
                  : "Based on your entries"}
              </small>
            </Link>
            <Link href={`${base}/timeline?type=PROBLEM`}>
              <span className="stat-icon">
                <Activity size={22} />
              </span>
              <strong>{o.activeProblems.length}</strong>
              <span>Marked active problems</span>
              <small>
                {o.unknownProblems.length
                  ? `${o.unknownProblems.length} with status unknown`
                  : "Based on your entries"}
              </small>
            </Link>
            <Link href={`${base}/timeline?type=ALLERGY`}>
              <span className="stat-icon">
                <ShieldAlert size={22} />
              </span>
              <strong>
                {o.allergies.length
                  ? o.allergies.length
                  : data.context?.allergyKnowledge === "NO_KNOWN"
                    ? "None known"
                    : "Unknown"}
              </strong>
              <span>Recorded allergies</span>
              <small>
                {o.allergies.length
                  ? "Owner-maintained information"
                  : data.context?.allergyKnowledge === "NO_KNOWN"
                    ? "Reported by owner"
                    : "No allergies entered"}
              </small>
            </Link>
          </div>
          <section className="health-reminders">
            <div className="section-heading">
              <h2>
                <CalendarDays size={20} /> Dates to keep in mind
              </h2>
            </div>
            {pet.status !== "ACTIVE" ? (
              <Empty>
                Reminders are paused for archived and memorial profiles.
              </Empty>
            ) : o.reminders.length || o.medicationReviews.length ? (
              <>
                {o.reminders.map(({ record: r, date, days }) => (
                  <Link
                    key={r.id}
                    href={`${base}/${r.id}`}
                    className="reminder-row"
                  >
                    <Syringe size={20} />
                    <div>
                      <strong>{r.title}</strong>
                      <p>
                        {days < 0
                          ? `${Math.abs(days)} day${days === -1 ? "" : "s"} past the entered due date`
                          : days === 0
                            ? "Entered due date is today"
                            : `Due in ${days} day${days === 1 ? "" : "s"}`}{" "}
                        · {dateLabel(date)}
                      </p>
                    </div>
                    <ArrowUpRight size={17} />
                  </Link>
                ))}
                {o.medicationReviews.map((r) => (
                  <Link
                    key={r.id}
                    className="reminder-row"
                    href={`${base}/${r.id}`}
                  >
                    <Pill size={20} />
                    <div>
                      <strong>Review {r.title}</strong>
                      <p>
                        The recorded end date has passed; status is still
                        active.
                      </p>
                    </div>
                    <ArrowUpRight size={17} />
                  </Link>
                ))}
              </>
            ) : (
              <Empty>
                No reminders from recorded dates in the next 30 days.
              </Empty>
            )}
            <p className="fine-print">
              Reminders use entered dates only.
              {o.missingDueDates
                ? ` ${o.missingDueDates} vaccination record(s) have no next due date.`
                : ""}
            </p>
          </section>
          <div className="health-columns">
            <section>
              <div className="section-heading">
                <h2>Recent history</h2>
                <Link className="text-link" href={`${base}/timeline`}>
                  Full timeline <ArrowUpRight size={16} />
                </Link>
              </div>
              {live.length ? (
                <div className="timeline-list">
                  {live.slice(0, 5).map((r) => (
                    <TimelineRow key={r.id} r={r} base={base} />
                  ))}
                </div>
              ) : (
                <div className="health-first-record">
                  <Heart size={30} />
                  <h3>Nothing recorded yet.</h3>
                  <p>
                    Add {pet.name}’s first health record. A short note is a good
                    start.
                  </p>
                  <Link className="button primary" href={`${base}/new`}>
                    Add a health record <Plus size={17} />
                  </Link>
                </div>
              )}
            </section>
            <aside className="health-side-note">
              <LockKeyhole size={24} />
              <h3>A little context for the next visit.</h3>
              <p>
                {o.visits[0]
                  ? `Last recorded vet visit: ${dateLabel(o.visits[0].occurredOn)}.`
                  : "No vet visits recorded yet."}
              </p>
              <Link className="button secondary full" href={`${base}/summary`}>
                Open health summary <ArrowUpRight size={17} />
              </Link>
              <button
                className="text-link"
                onClick={() => setContextEditor(true)}
              >
                Emergency notes & allergy knowledge
              </button>
              <p className="fine-print">
                Private, even when {pet.name}’s pet profile is public.
              </p>
            </aside>
          </div>
        </>
      ) : view === "timeline" ? (
        <>
          <div className="health-filter-row">
            <label>
              Record type
              <select
                value={
                  filter === "ALL" &&
                  query.get("type") &&
                  healthKinds.includes(query.get("type") as HealthKind)
                    ? query.get("type")!
                    : filter
                }
                onChange={(e) => {
                  setFilter(e.target.value);
                  if (query.has("type")) router.replace(`${base}/timeline`);
                }}
              >
                <option value="ALL">All health records</option>
                {healthKinds.map((k) => (
                  <option value={k} key={k}>
                    {kindLabels[k]}
                  </option>
                ))}
                <option value="REMOVED">Removed records</option>
              </select>
            </label>
            <label className="search-box">
              <Search size={17} />
              <input
                aria-label="Search health records"
                placeholder="Search their history"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
          </div>
          {filter === "REMOVED" && (
            <p className="fine-print">
              These records are hidden from the normal timeline and summary.
              Their history is retained and you can restore them.
            </p>
          )}
          <div className="timeline-list">
            {items.map((r, i, arr) => (
              <div key={r.id}>
                {(i === 0 ||
                  (r.occurredOn?.slice(0, 7) || "") !==
                    (arr[i - 1].occurredOn?.slice(0, 7) || "")) && (
                  <h2 className="timeline-month">
                    {r.occurredOn
                      ? new Date(r.occurredOn).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "long",
                          timeZone: "UTC",
                        })
                      : "Date not recorded"}
                  </h2>
                )}
                <TimelineRow r={r} base={base} />
              </div>
            ))}
          </div>
          {!items.length && (
            <Empty>
              No matching records. Add an entry or try another filter.
            </Empty>
          )}
        </>
      ) : view === "documents" ? (
        <>
          <div className="section-heading">
            <h2>Reports, prescriptions & photos</h2>
            <Link className="text-link" href={`${base}/new?kind=DOCUMENT`}>
              Add document <Plus size={17} />
            </Link>
          </div>
          <div className="health-document-grid">
            {live.flatMap((r) =>
              r.attachments.map((f) => (
                <Link
                  key={f.id}
                  href={`${base}/${r.id}`}
                  className="health-document-card"
                >
                  {f.mime.startsWith("image/") ? (
                    <img
                      src={`/api/health-files/${f.id}?thumb=1`}
                      alt={f.description || f.filename}
                    />
                  ) : (
                    <div className="pdf-placeholder">
                      <FileText size={38} />
                      <span>PDF</span>
                    </div>
                  )}
                  <div>
                    <strong>{f.description || f.filename}</strong>
                    <p>{r.title}</p>
                    <small>{dateText(r)}</small>
                  </div>
                </Link>
              )),
            )}
          </div>
          {!live.some((r) => r.attachments.length) && (
            <Empty>
              No documents yet. Photograph a report or upload a file to keep it
              with {pet.name}’s history.
            </Empty>
          )}
        </>
      ) : record ? (
        <>
          <Link className="back-link" href={`${base}/timeline`}>
            <ArrowLeft size={17} /> Back to timeline
          </Link>
          <article className="health-record-card">
            <span className="eyebrow">{kindLabels[record.kind]}</span>
            <h2>{record.title}</h2>
            <p className="record-date">
              {dateText(record)}
              {record.sourceClinic ? ` · ${record.sourceClinic}` : ""}
            </p>
            {record.deletedAt && (
              <p className="error">
                Removed from normal views. The record and its edit history are
                retained.
              </p>
            )}
            <RecordFields record={record} />
            {related && (
              <p className="linked-visit">
                Related visit:{" "}
                <Link href={`${base}/${related.id}`}>
                  {related.title}
                  {related.deletedAt ? " (removed)" : ""}
                </Link>
              </p>
            )}
            <div className="record-provenance">
              <span>{sourceLabels[record.sourceType]}</span>
              <p>
                Entered {new Date(record.createdAt).toLocaleString()} by{" "}
                {record.enteredBy === ownerId ? "you" : "a previous custodian"}.
                Last updated {new Date(record.updatedAt).toLocaleString()}.
              </p>
              <small>Not veterinarian-verified.</small>
            </div>
            {!record.deletedAt && (
              <>
                <div className="section-heading">
                  <h3>Supporting files</h3>
                  <span className="file-count">
                    {record.attachments.length} / 5
                  </span>
                </div>
                {record.attachments.length ? (
                  <div className="record-files">
                    {record.attachments.map((f) => (
                      <div key={f.id}>
                        <a
                          href={`/api/health-files/${f.id}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {f.mime.startsWith("image/") ? (
                            <img
                              src={`/api/health-files/${f.id}?thumb=1`}
                              alt={f.description || f.filename}
                            />
                          ) : (
                            <FileText size={35} />
                          )}
                          <strong>{f.description || f.filename}</strong>
                          <small>
                            {f.mime === "application/pdf"
                              ? "Download PDF"
                              : "Open photo"}{" "}
                            · {Math.max(1, Math.round(f.bytes / 1024))} KB
                          </small>
                        </a>
                        <button
                          className="text-button"
                          disabled={busy}
                          onClick={() => {
                            if (
                              confirm(
                                "Remove this file from the record? Access ends immediately. It is retained internally for 30 days before deletion.",
                              )
                            )
                              void act(
                                () =>
                                  healthApi(
                                    `/api/health/${pet.id}/${record.id}/files/${f.id}`,
                                    "DELETE",
                                    { version: record.version },
                                  ),
                                "File removed from view.",
                              );
                          }}
                        >
                          Remove file
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty>No supporting files yet.</Empty>
                )}
                <Link className="text-link" href={`${base}/${record.id}/edit`}>
                  <Paperclip size={17} /> Add a file or photo
                </Link>
              </>
            )}
            <div className="record-actions">
              {record.deletedAt ? (
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() =>
                    act(
                      () =>
                        healthApi(
                          `/api/health/${pet.id}/${record.id}/restore`,
                          "POST",
                          { version: record.version },
                        ),
                      "Record restored.",
                    )
                  }
                >
                  Restore record
                </button>
              ) : (
                <>
                  <Link
                    className="button primary"
                    href={`${base}/${record.id}/edit`}
                  >
                    Edit record <ArrowUpRight size={17} />
                  </Link>
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() => {
                      if (
                        confirm(
                          "Remove this entry from the timeline and summary? Its history is retained and you can restore it later.",
                        )
                      )
                        void act(
                          () =>
                            healthApi(
                              `/api/health/${pet.id}/${record.id}`,
                              "DELETE",
                              { version: record.version },
                            ),
                          "Record removed from normal views.",
                        );
                    }}
                  >
                    Remove record
                  </button>
                </>
              )}
              <button
                className="button secondary"
                onClick={async () => {
                  try {
                    setRevisions(
                      await healthApi(
                        `/api/health/${pet.id}/${record.id}/revisions`,
                      ),
                    );
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                <History size={17} /> Edit history
              </button>
            </div>
            {record.kind === "VISIT" && !record.deletedAt && (
              <div className="linked-items">
                <div className="section-heading">
                  <h3>Linked to this visit</h3>
                  <Link
                    className="text-link"
                    href={`${base}/new?visit=${record.id}`}
                  >
                    Add linked entry <Plus size={17} />
                  </Link>
                </div>
                {live
                  .filter((r) => r.linkedEncounterId === record.id)
                  .map((r) => (
                    <TimelineRow key={r.id} r={r} base={base} />
                  ))}
                {!live.some((r) => r.linkedEncounterId === record.id) && (
                  <Empty>No linked medications or other entries yet.</Empty>
                )}
              </div>
            )}
          </article>
          {revisions && (
            <section className="health-history">
              <h2>Edit history</h2>
              <p className="fine-print">
                Each version preserves the entry as it was saved. Historical
                filenames are shown without granting access to removed files.
              </p>
              {revisions.map((r) => (
                <details key={r.id}>
                  <summary>
                    Version {r.version} · {r.action}
                    <small>
                      {new Date(r.createdAt).toLocaleString()} ·{" "}
                      {r.actorId === ownerId ? "You" : "Previous custodian"}
                    </small>
                  </summary>
                  <h3>{r.snapshot.title}</h3>
                  <p>
                    {dateText(r.snapshot)} ·{" "}
                    {sourceLabels[r.snapshot.sourceType]}
                  </p>
                  <RecordFields record={r.snapshot} />
                  {r.snapshot.attachments?.length > 0 && (
                    <p className="fine-print">
                      Files:{" "}
                      {r.snapshot.attachments.map((f) => f.filename).join(", ")}
                    </p>
                  )}
                </details>
              ))}
            </section>
          )}
        </>
      ) : (
        <Empty>This health record is not available.</Empty>
      )}
      {contextEditor && (
        <ContextEditor
          context={data.context}
          pet={pet}
          hasAllergies={o.allergies.length > 0}
          close={() => setContextEditor(false)}
          save={async (body) => {
            await healthApi(`/api/health/${pet.id}/context`, "PATCH", body);
            await refresh();
            setContextEditor(false);
            setToast("Summary notes saved.");
          }}
        />
      )}
    </section>
  );
}
function ContextEditor({
  context,
  pet,
  hasAllergies,
  close,
  save,
}: {
  context: HealthContext | null;
  pet: HealthPet;
  hasAllergies: boolean;
  close: () => void;
  save: (value: unknown) => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = dialog.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <dialog
      ref={dialog}
      aria-labelledby="context-title"
      className="health-context-editor"
      onCancel={close}
    >
      <div className="modal-heading">
        <h2 id="context-title">Notes for {pet.name}’s summary</h2>
        <button
          className="icon-button"
          aria-label="Close summary notes"
          onClick={close}
        >
          <X />
        </button>
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const f = new FormData(e.currentTarget);
          try {
            await save({
              emergencyNotes: f.get("emergencyNotes"),
              allergyKnowledge: f.get("allergyKnowledge"),
              version: context?.version || 0,
            });
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Emergency notes <small>Optional</small>
          <textarea
            name="emergencyNotes"
            rows={4}
            maxLength={3000}
            defaultValue={context?.emergencyNotes || ""}
            placeholder="Important information you want the vet to see quickly."
            autoFocus
          />
        </label>
        <label>
          Allergy knowledge
          <select
            name="allergyKnowledge"
            defaultValue={
              hasAllergies ? "UNKNOWN" : context?.allergyKnowledge || "UNKNOWN"
            }
          >
            <option value="UNKNOWN">
              Unknown / rely on recorded allergy entries
            </option>
            {!hasAllergies && (
              <option value="NO_KNOWN">I report no known allergies</option>
            )}
          </select>
        </label>
        <p className="fine-print">
          An explicit owner statement is kept separate from missing information.
          This does not mark your pet as clinically cleared.
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="button primary full" disabled={busy}>
          {busy ? "Saving…" : "Save summary notes"}
        </button>
      </form>
    </dialog>
  );
}
