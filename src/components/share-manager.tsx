"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import SummaryPdfActions from "./summary-pdf-actions";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Copy,
  Eye,
  Link2,
  LockKeyhole,
  Plus,
  QrCode,
  RefreshCw,
  Share2,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import {
  defaultSelection,
  sectionNames,
  expiryNames,
  type ShareSelection,
  type SummaryContent,
} from "@/lib/share-rules";
import { kindLabels, dateLabel } from "@/lib/health-rules";
import { healthApi, type HealthPet, type HealthPayload } from "./health-types";
import SummarySnapshot from "./summary-snapshot";
type Draft = { id: string; content: SummaryContent; draftExpiresAt: string };
type Created = {
  id: string;
  content: SummaryContent;
  createdAt: string;
  expiresAt: string | null;
  url: string;
  qr: string;
};
type Listed = {
  id: string;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  status: string;
  snapshot: { createdAt: string };
};
export default function ShareManager({
  pet,
  data,
  create,
}: {
  pet: HealthPet;
  data: HealthPayload;
  create: boolean;
}) {
  const base = `/app/pets/${pet.id}/health`,
    api = `/api/shares/${pet.id}`;
  const [selection, setSelection] = useState<ShareSelection>({
      ...defaultSelection,
    }),
    [draft, setDraft] = useState<Draft | null>(null),
    [created, setCreated] = useState<Created | null>(null),
    [expiry, setExpiry] = useState<keyof typeof expiryNames>("DAY"),
    [confirmed, setConfirmed] = useState(false),
    [noExpiry, setNoExpiry] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [rows, setRows] = useState<Listed[]>([]),
    [loading, setLoading] = useState(!create),
    [view, setView] = useState<SummaryContent | null>(null),
    [focus, setFocus] = useState(false),
    [nativeShare, setNativeShare] = useState(false);
  const copyInput = useRef<HTMLInputElement>(null);
  async function refresh() {
    const result = await healthApi(api);
    setRows(result.shares);
    setLoading(false);
  }
  useEffect(() => {
    setNativeShare(typeof navigator.share === "function");
  }, []);
  useEffect(() => {
    if (create) return;
    let active = true;
    const load = () =>
      healthApi(api)
        .then((result) => {
          if (active) {
            setRows(result.shares);
            setLoading(false);
          }
        })
        .catch((e) => {
          if (active) {
            setError(e.message);
            setLoading(false);
          }
        });
    void load();
    const timer = setInterval(() => void load(), 30000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [create, api]);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setToast("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const candidates = data.records.filter(
    (r) => !r.deletedAt && !["DOCUMENT", "NOTE"].includes(r.kind),
  );
  const fieldNames = {
    petName: "Pet name",
    demographics: "Species, breed, age and sex",
    ownerName: "Owner name",
    microchip: "Microchip",
    freeText: "Notes, instructions, reactions and outcomes",
    clinicNames: "Clinic names",
  };
  async function copy() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.url);
      setToast("Link copied.");
    } catch {
      copyInput.current?.focus();
      copyInput.current?.select();
      setToast(
        "Select and copy the complete link below, including everything after #.",
      );
    }
  }
  return (
    <section className={`share-manager ${focus ? "share-focus" : ""}`}>
      {focus ? (
        <button className="button secondary" onClick={() => setFocus(false)}>
          <X size={18} />
          Exit full-screen snapshot
        </button>
      ) : (
        <Link href={`${base}/summary`} className="back-link">
          <ArrowLeft size={17} />
          {pet.name}’s summary
        </Link>
      )}
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            <ShieldCheck size={15} />
            SHARE ONLY WHAT YOU CHOOSE
          </span>
          <h1>{create ? "Share a health summary." : "Shared links."}</h1>
          <p>
            {create
              ? "Choose the details, review the snapshot, then share a PDF or protected link."
              : "Manage protected snapshots shared for " + pet.name + "."}
          </p>
        </div>
        {!create && (
          <Link className="button primary" href={`${base}/shares/new`}>
            <Plus size={18} />
            New share link
          </Link>
        )}
        {create && (
          <Link className="text-link" href={`${base}/shares`}>
            Shared links
            <ArrowUpRight size={17} />
          </Link>
        )}
      </div>
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
      {!create ? (
        <>
          <div className="share-warning">
            <LockKeyhole size={21} />
            <p>
              Revocation blocks future access. It cannot remove screenshots or
              saved copies. Secret links are shown only when created; create a
              new link if you no longer have the original.
            </p>
          </div>
          <div className="button-row">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => run(refresh)}
            >
              <RefreshCw size={17} />
              Refresh list
            </button>
            {rows.some((r) => r.status === "Active") && (
              <button
                className="text-button"
                disabled={busy}
                onClick={() => {
                  if (
                    confirm(
                      `Revoke all health-summary links for ${pet.name}? Anyone with those links will lose future access.`,
                    )
                  )
                    void run(async () => {
                      await healthApi(`${api}/all`, "DELETE");
                      await refresh();
                      setToast("All links revoked.");
                    });
                }}
              >
                Revoke all links
              </button>
            )}
          </div>
          {loading ? (
            <p role="status">Loading shared links…</p>
          ) : rows.length ? (
            <div className="share-list">
              {rows.map((row) => (
                <article key={row.id}>
                  <div>
                    <span className={`share-state ${row.status.toLowerCase()}`}>
                      {row.status}
                    </span>
                    <h2>Shared {new Date(row.createdAt).toLocaleString()}</h2>
                    <p>
                      Snapshot captured{" "}
                      {new Date(row.snapshot.createdAt).toLocaleString()}
                    </p>
                    <p>
                      {row.expiresAt
                        ? `Expiry: ${new Date(row.expiresAt).toLocaleString()}`
                        : "No automatic expiry"}
                    </p>
                  </div>
                  <div className="button-row">
                    <button
                      className="button secondary"
                      disabled={busy}
                      onClick={() =>
                        run(async () =>
                          setView(await healthApi(`${api}/${row.id}`)),
                        )
                      }
                    >
                      <Eye size={17} />
                      View snapshot
                    </button>
                    {row.status === "Active" && (
                      <button
                        className="button secondary"
                        disabled={busy}
                        onClick={() => {
                          if (
                            confirm(
                              "Revoke this link? It will stop working for recipients.",
                            )
                          )
                            void run(async () => {
                              await healthApi(`${api}/${row.id}`, "DELETE");
                              await refresh();
                              setToast("Link revoked.");
                            });
                        }}
                      >
                        <Trash2 size={17} />
                        Revoke link
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="health-first-record">
              <Link2 size={30} />
              <h2>No shared links yet.</h2>
              <p>
                Your live health record stays private. Create a selected
                snapshot when you need to share it.
              </p>
            </div>
          )}
          <p className="fine-print">
            Showing up to 200 most recent links. Status refreshes every 30
            seconds.
          </p>
          {view && (
            <div className="share-saved-preview">
              <button
                className="button secondary"
                onClick={() => setView(null)}
              >
                <X size={17} />
                Close snapshot
              </button>
              <SummarySnapshot content={view} />
            </div>
          )}
        </>
      ) : created ? (
        <>
          <div className="share-created">
            <div>
              <span className="eyebrow">
                <Check size={16} />
                LINK CREATED
              </span>
              <h2>Ready to share.</h2>
              <p>
                {created.expiresAt
                  ? `Expires ${new Date(created.expiresAt).toLocaleString()}`
                  : "This link stays available until revoked."}
              </p>
              <p>
                Copy it now. The secret link is not stored for later retrieval.
              </p>
              <div className="button-row">
                <button className="button primary" onClick={() => void copy()}>
                  <Copy size={17} />
                  Copy link
                </button>
                {nativeShare && (
                  <button
                    className="button secondary"
                    onClick={async () => {
                      try {
                        await navigator.share({
                          title: "Petish health summary",
                          url: created.url,
                        });
                      } catch (e) {
                        if ((e as Error).name !== "AbortError")
                          setToast(
                            "Sharing is unavailable here. Use Copy link instead.",
                          );
                      }
                    }}
                  >
                    <Share2 size={17} />
                    Share…
                  </button>
                )}
              </div>
              <label className="share-url-label">
                Protected link
                <input
                  ref={copyInput}
                  value={created.url}
                  readOnly
                  spellCheck={false}
                  autoComplete="off"
                  onFocus={(e) => e.target.select()}
                />
              </label>
              <p className="fine-print">
                Anyone with the complete link or QR code can view this snapshot
                and forward it.
              </p>
              <button
                className="text-button"
                disabled={busy}
                onClick={() => {
                  if (confirm("Revoke this link now?"))
                    void run(async () => {
                      await healthApi(`${api}/${created.id}`, "DELETE");
                      setCreated(null);
                      setDraft(null);
                      setToast(
                        "Link revoked. Create a new preview if you need another.",
                      );
                    });
                }}
              >
                Revoke this link
              </button>
            </div>
            <figure>
              <img
                src={created.qr}
                alt="QR code for this protected health-summary link"
                width={280}
                height={280}
              />
              <figcaption>
                <QrCode size={16} />
                Same protected link. No health data is encoded in the QR code.
              </figcaption>
            </figure>
          </div>
          <SummarySnapshot content={created.content} />
          <SummaryPdfActions key={created.id} content={created.content} />
        </>
      ) : draft ? (
        <>
          <div className="share-review-heading">
            <h2>Review exactly what will be shared</h2>
            <p>
              Later edits to the live record will not change this snapshot.
              Documents and attachment links are excluded.
            </p>
            <div className="button-row">
              <button
                className="button secondary"
                onClick={() => {
                  setDraft(null);
                  setConfirmed(false);
                }}
              >
                Change included details
              </button>
              <button
                className="button secondary"
                onClick={() => setFocus(true)}
              >
                <Eye size={17} />
                Show on screen
              </button>
            </div>
          </div>
          <SummarySnapshot content={draft.content} />
          <SummaryPdfActions key={draft.id} content={draft.content} />
          <form
            className="share-confirm"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                const result = await healthApi(`${api}/create`, "POST", {
                  snapshotId: draft.id,
                  expiry,
                  confirmBearer: confirmed,
                  confirmNoExpiry: noExpiry,
                });
                setCreated(result);
                setFocus(false);
              });
            }}
          >
            <h2>Choose how long the link works</h2>
            <label>
              Link expiry
              <select
                value={expiry}
                onChange={(e) => {
                  setExpiry(e.target.value as keyof typeof expiryNames);
                  setNoExpiry(false);
                }}
              >
                {Object.entries(expiryNames).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                    {key === "DAY" ? " · default" : ""}
                  </option>
                ))}
              </select>
            </label>
            {expiry === "UNTIL_REVOKED" && (
              <label className="share-checkbox">
                <input
                  type="checkbox"
                  checked={noExpiry}
                  onChange={(e) => setNoExpiry(e.target.checked)}
                  required
                />
                I explicitly want no automatic expiry. I will revoke this link
                when it is no longer needed.
              </label>
            )}
            <label className="share-checkbox">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                required
              />
              I reviewed this snapshot. I understand anyone with the link can
              view, copy, or forward it, and revocation cannot erase saved
              copies.
            </label>
            <button className="button primary" disabled={busy}>
              <Link2 size={18} />
              {busy ? "Creating…" : "Create protected link"}
            </button>
            <p className="fine-print">
              This preview can be shared for 15 minutes after it is generated.
              An expired preview must be regenerated.
            </p>
          </form>
        </>
      ) : (
        <form
          className="share-options"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              setDraft(await healthApi(`${api}/preview`, "POST", selection));
              setConfirmed(false);
            });
          }}
        >
          <div className="share-warning">
            <LockKeyhole size={22} />
            <p>
              Owner name and microchip start excluded. Review names and free
              text for personal information; excluding an identity field does
              not automatically redact it from your notes or record titles.
            </p>
          </div>
          <fieldset>
            <legend>Identity and detail fields</legend>
            <div className="share-choice-grid">
              {Object.entries(fieldNames).map(([key, label]) => (
                <label className="share-checkbox" key={key}>
                  <input
                    type="checkbox"
                    checked={selection[key as keyof typeof fieldNames]}
                    onChange={(e) =>
                      setSelection({ ...selection, [key]: e.target.checked })
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Summary sections</legend>
            <div className="share-choice-grid">
              {Object.entries(sectionNames).map(([key, label]) => (
                <label className="share-checkbox" key={key}>
                  <input
                    type="checkbox"
                    checked={selection.sections.includes(
                      key as keyof typeof sectionNames,
                    )}
                    onChange={(e) =>
                      setSelection({
                        ...selection,
                        sections: e.target.checked
                          ? [
                              ...selection.sections,
                              key as keyof typeof sectionNames,
                            ]
                          : selection.sections.filter((s) => s !== key),
                      })
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <details className="share-record-choices">
            <summary>
              Exclude individual entries <span>Optional</span>
            </summary>
            <p className="fine-print">
              Unchecked entries cannot enter this snapshot. Only active/unknown
              medications and problems, all selected allergies, six recent
              vaccinations, three recent visits and five major procedures
              appear. Large medication/problem/allergy sections are limited to
              30 entries and labelled if shortened.
            </p>
            {candidates.map((r) => (
              <label className="share-checkbox" key={r.id}>
                <input
                  type="checkbox"
                  checked={!selection.excludedRecordIds.includes(r.id)}
                  onChange={(e) =>
                    setSelection({
                      ...selection,
                      excludedRecordIds: e.target.checked
                        ? selection.excludedRecordIds.filter(
                            (id) => id !== r.id,
                          )
                        : [...selection.excludedRecordIds, r.id],
                    })
                  }
                />
                <span>
                  <strong>{r.title}</strong>
                  <small>
                    {kindLabels[r.kind]} · {dateLabel(r.occurredOn)}
                  </small>
                </span>
              </label>
            ))}
          </details>
          <button className="button primary" disabled={busy}>
            <Eye size={18} />
            {busy ? "Preparing preview…" : "Preview snapshot"}
          </button>
        </form>
      )}
    </section>
  );
}
