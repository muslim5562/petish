"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  PawPrint,
  MapPin,
  Search,
  ArrowLeft,
  Bell,
  Heart,
  ShieldCheck,
} from "lucide-react";
type Pet = {
  id: string;
  name: string;
  species: string;
  breed: string | null;
  colour: string | null;
  markings: string | null;
  status: string;
  images: { id: string }[];
};
type Photo = { id: string; url?: string };
type Reply = {
  id: string;
  kind: string;
  email: string;
  phone: string;
  details: string;
  locality: string;
  occurredAt: string;
  photos: Photo[];
};
type Report = {
  id: string;
  kind: string;
  state?: string;
  updatedAt?: string;
  petName: string;
  species: string;
  breed: string;
  colour: string;
  details: string;
  locality: string;
  occurredAt: string;
  approximateTime: string;
  custody: string;
  phone: string;
  publicPhone: boolean;
  reward: string;
  photos: Photo[];
  responses?: Reply[];
  closureReason?: string;
  confirmedAt?: string;
  photoReuse?: boolean;
};
type Meta = {
  user: { id: string; email: string } | null;
  moderator: boolean;
  localMail: boolean;
  guestEmailAvailable: boolean;
  unread: number;
};
type Notice = {
  id: string;
  reportId: string;
  subject: string;
  readAt: string | null;
  createdAt: string;
};
const base = "/api/lost-found";
async function api<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(base + path, {
    method: body === undefined ? "GET" : "POST",
    cache: "no-store",
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
  });
  const d = await r.json();
  if (!r.ok)
    throw new Error(d.error || d.message || "Unable to complete this request.");
  return d as T;
}
const when = (s: string) => s?.slice(0, 10) || "";
const title = (r: Report) =>
  r.kind === "MISSING"
    ? `${r.petName || "Pet"} is missing`
    : `Found ${r.species === "CAT" ? "cat" : "dog"}${r.petName ? ` · ${r.petName}` : ""}`;
function state(r: Report) {
  return r.state === "OPEN" &&
    r.confirmedAt &&
    +new Date(r.confirmedAt) < Date.now() - 60 * 86400000
    ? "ARCHIVED"
    : r.state;
}
function PrivatePhoto({
  id,
  token,
  alt,
}: {
  id: string;
  token: string;
  alt: string;
}) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let active = true,
      object = "";
    fetch(`${base}/photos/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      cache: "no-store",
    })
      .then(async (r) => {
        if (!r.ok) return;
        object = URL.createObjectURL(await r.blob());
        if (active) setUrl(object);
        else URL.revokeObjectURL(object);
      })
      .catch(() => {});
    return () => {
      active = false;
      if (object) URL.revokeObjectURL(object);
    };
  }, [id, token]);
  return url ? (
    <img src={url} alt={alt} />
  ) : (
    <span className="lf-photo-loading">Photo unavailable or loading</span>
  );
}
function LocalMail({ meta }: { meta: Meta }) {
  return meta.localMail ? (
    <p className="lf-demo-note">
      Local testing: verification and notification emails appear in{" "}
      <Link href="/local-mail" target="_blank">
        Local mailbox
      </Link>
      . No real email is sent.
    </p>
  ) : null;
}
function Card({ r, manager = false }: { r: Report; manager?: boolean }) {
  return (
    <Link
      className="lf-card"
      href={manager ? `/lost-found/manage?id=${r.id}` : `/lost-found/${r.id}`}
    >
      <div className="lf-card-image">
        {r.photos?.[0] ? (
          <img src={r.photos[0].url} alt={r.petName || "Reported pet"} />
        ) : (
          <PawPrint size={50} />
        )}
        <span className={`lf-badge ${r.kind.toLowerCase()}`}>
          {manager ? state(r) : r.kind === "MISSING" ? "Missing" : "Found"}
        </span>
      </div>
      <div className="lf-card-copy">
        <h2>{title(r)}</h2>
        <p>
          <MapPin size={15} />
          {r.locality}
        </p>
        <p>
          {r.breed || r.species} {r.occurredAt && `· ${when(r.occurredAt)}`}
        </p>
        {r.kind === "FOUND" && (
          <small>
            {r.custody === "IN_CARE" ? "In finder’s care" : "Seen roaming"}
          </small>
        )}
      </div>
    </Link>
  );
}
export default function LostFound() {
  const pathname = usePathname(),
    query = useSearchParams();
  const route = pathname.split("/").filter(Boolean)[1] || "";
  const [meta, setMeta] = useState<Meta | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    api<Meta>("/meta")
      .then(setMeta)
      .catch((e) => setError(e.message));
  }, [pathname]);
  return (
    <div className="lf-shell">
      <header className="lf-nav">
        <Link className="brand" href="/">
          <PawPrint />
          petish
        </Link>
        <nav aria-label="Lost and found">
          <Link href="/lost-found">Bulletin board</Link>
          <Link href="/lost-found/manage">
            My reports{" "}
            {meta && meta.unread > 0 && (
              <span className="lf-count">{meta.unread}</span>
            )}
          </Link>
          <Link href={meta?.user ? "/app" : "/login"}>
            {meta?.user ? "My Petish" : "Sign in"}
          </Link>
          {meta?.moderator && (
            <Link href="/lost-found/moderate">Moderation</Link>
          )}
        </nav>
      </header>
      <main className="lf-main">
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {!meta ? (
          <p role="status">Opening the board…</p>
        ) : route === "new" ? (
          <ReportForm meta={meta} initialPet={query.get("pet") || ""} />
        ) : route === "manage" ? (
          <Manager meta={meta} id={query.get("id") || ""} />
        ) : route === "verify" ? (
          <Verify meta={meta} />
        ) : route === "reunited" ? (
          <Reunited meta={meta} />
        ) : route === "moderate" ? (
          <Moderation meta={meta} />
        ) : route ? (
          <Detail id={route} meta={meta} />
        ) : (
          <Board />
        )}
      </main>
      <footer className="lf-footer">
        <Heart size={17} /> Helping familiar faces find their way home.
        <span>
          Petish connects people; a report or claim does not establish
          ownership.
        </span>
      </footer>
    </div>
  );
}
function Board() {
  const [rows, setRows] = useState<Report[]>([]),
    [kind, setKind] = useState(""),
    [species, setSpecies] = useState(""),
    [q, setQ] = useState(""),
    [since, setSince] = useState(""),
    [custody, setCustody] = useState(""),
    [cursor, setCursor] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function search(more = false) {
    setBusy(true);
    setError("");
    try {
      const params = new URLSearchParams({
        kind,
        species,
        q,
        since,
        custody,
        ...(more && cursor ? { cursor } : {}),
      });
      const d = await api<{ reports: Report[]; nextCursor: string | null }>(
        `?${params}`,
      );
      setRows((old) => (more ? [...old, ...d.reports] : d.reports));
      setCursor(d.nextCursor);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void api<{ reports: Report[]; nextCursor: string | null }>("")
      .then((d) => {
        setRows(d.reports);
        setCursor(d.nextCursor);
      })
      .catch((e) => setError(e.message));
  }, []);
  return (
    <>
      <section className="lf-hero">
        <div>
          <span className="eyebrow">A LITTLE HELP FROM THE NEIGHBOURHOOD</span>
          <h1>
            Let’s bring them
            <br />
            <em>home.</em>
          </h1>
          <p>
            Missing a familiar face, or looking out for a new one? Browse local
            reports and share what you know.
          </p>
          <div className="button-row">
            <Link
              className="button primary"
              href="/lost-found/new?kind=MISSING"
            >
              Report a missing pet
            </Link>
            <Link
              className="button secondary"
              href="/lost-found/new?kind=FOUND"
            >
              I found a pet
            </Link>
          </div>
        </div>
        <div className="lf-hero-art">
          <PawPrint size={110} />
          <strong>Every sighting can help.</strong>
          <p>No account needed to browse.</p>
        </div>
      </section>
      <form
        className="lf-search"
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <label>
          Reports
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">All reports</option>
            <option value="MISSING">Missing pets</option>
            <option value="FOUND">Found pets</option>
          </select>
        </label>
        <label>
          Species
          <select value={species} onChange={(e) => setSpecies(e.target.value)}>
            <option value="">Cats & dogs</option>
            <option value="CAT">Cats</option>
            <option value="DOG">Dogs</option>
          </select>
        </label>
        <label>
          Town, pet name or colour
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            maxLength={160}
            placeholder="Search your neighbourhood"
          />
        </label>
        <label>
          Since
          <input
            type="date"
            value={since}
            onChange={(e) => setSince(e.target.value)}
          />
        </label>
        <label>
          Found pet’s situation
          <select value={custody} onChange={(e) => setCustody(e.target.value)}>
            <option value="">Any</option>
            <option value="IN_CARE">In finder’s care</option>
            <option value="ROAMING">Seen roaming</option>
          </select>
        </label>
        <button className="button primary" disabled={busy}>
          <Search size={17} />
          Search
        </button>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="lf-section-heading">
        <h2>Neighbourhood reports</h2>
        <p>Open reports only · newest first</p>
      </div>
      {rows.length ? (
        <div className="lf-grid">
          {rows.map((r) => (
            <Card r={r} key={r.id} />
          ))}
        </div>
      ) : (
        <div className="lf-empty">
          <PawPrint />
          <h2>No open reports here yet.</h2>
          <p>Try a different search, or create a missing or found report.</p>
        </div>
      )}
      {cursor && (
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => void search(true)}
        >
          Load more reports
        </button>
      )}
    </>
  );
}
type Fields = {
  kind: string;
  petId: string;
  email: string;
  petName: string;
  species: string;
  breed: string;
  colour: string;
  details: string;
  locality: string;
  occurredAt: string;
  approximateTime: string;
  custody: string;
  phone: string;
  publicPhone: boolean;
  reward: string;
  photoReuse: boolean;
  website: string;
};
function ReportForm({ meta, initialPet }: { meta: Meta; initialPet: string }) {
  const query = useSearchParams();
  const [pets, setPets] = useState<Pet[]>([]),
    [fields, setFields] = useState<Fields>({
      kind: initialPet || query.get("kind") === "MISSING" ? "MISSING" : "FOUND",
      petId: initialPet,
      email: meta.user?.email || "",
      petName: "",
      species: "CAT",
      breed: "",
      colour: "",
      details: "",
      locality: "",
      occurredAt: new Date().toISOString().slice(0, 10),
      approximateTime: "",
      custody: "IN_CARE",
      phone: "",
      publicPhone: false,
      reward: "",
      photoReuse: false,
      website: "",
    }),
    [photoIds, setPhotoIds] = useState<string[]>([]),
    [files, setFiles] = useState<File[]>([]),
    [previews, setPreviews] = useState<string[]>([]),
    [review, setReview] = useState(false),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState<{
      id: string;
      state: string;
      message?: string;
    } | null>(null);
  const set = (name: keyof Fields, value: string | boolean) =>
    setFields((f) => ({ ...f, [name]: value }));
  function choose(pet: Pet | undefined) {
    setPhotoIds([]);
    setFields((f) => ({
      ...f,
      petId: pet?.id || "",
      petName: pet?.name || "",
      species: pet?.species || "CAT",
      breed: pet?.breed || "",
      colour: pet?.colour || "",
      details: pet?.markings || "",
    }));
  }
  useEffect(() => {
    if (meta.user)
      fetch("/api/pets", { cache: "no-store" })
        .then((r) => r.json())
        .then((p: Pet[]) => {
          setPets(p.filter((x) => !["DECEASED", "REHOMED"].includes(x.status)));
          if (initialPet) choose(p.find((x) => x.id === initialPet));
        })
        .catch(() => setError("Could not load your pet profiles."));
  }, [meta.user, initialPet]);
  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach(URL.revokeObjectURL);
  }, [files]);
  const pet = pets.find((p) => p.id === fields.petId);
  async function submit() {
    setBusy(true);
    setError("");
    try {
      const data = new FormData();
      data.set(
        "data",
        JSON.stringify({
          ...fields,
          petId: fields.kind === "MISSING" ? fields.petId : undefined,
          consent,
          photoIds,
        }),
      );
      files.forEach((f) => data.append("photos", f));
      setResult(await api("", data));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (result)
    return (
      <section className="lf-panel">
        <ShieldCheck />
        <h1>
          {result.state === "OPEN"
            ? "Your report is on the board."
            : "Check your email."}
        </h1>
        <p role="status">
          {result.message ||
            "You can manage responses and close the case from My reports."}
        </p>
        <LocalMail meta={meta} />
        <Link
          className="button primary"
          href={
            result.state === "OPEN"
              ? `/lost-found/${result.id}`
              : "/lost-found/manage"
          }
        >
          {result.state === "OPEN" ? "View report" : "My reports"}
        </Link>
      </section>
    );
  return (
    <>
      <Link className="back-link" href="/lost-found">
        <ArrowLeft size={16} />
        Back to the board
      </Link>
      <h1>
        {review
          ? "Review your public report."
          : fields.kind === "MISSING"
            ? "A familiar face is missing."
            : "Found a little wanderer?"}
      </h1>
      <LocalMail meta={meta} />
      {fields.kind === "MISSING" && !meta.user ? (
        <div className="lf-panel">
          <p>
            Sign in to report an Inhouse or Care stray pet from your profile.
          </p>
          <Link className="button primary" href="/login">
            Sign in to Petish
          </Link>
        </div>
      ) : !meta.guestEmailAvailable && !meta.user ? (
        <p className="error">
          Guest verification is unavailable in this temporary preview.
        </p>
      ) : (
        <form
          className="lf-panel lf-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (review) {
              void submit();
              return;
            }
            if (
              files.length + photoIds.length < 1 ||
              files.length + photoIds.length > 2
            ) {
              setError("Choose one or two pet photos.");
              return;
            }
            setError("");
            setReview(true);
          }}
        >
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {review ? (
            <>
              <span className="lf-badge">{fields.kind}</span>
              <h2>{fields.petName || "Found pet"}</h2>
              <p>
                {fields.species} · {fields.breed || "Breed unknown"} ·{" "}
                {fields.colour || "Colour not recorded"}
              </p>
              <p>
                <strong>{fields.locality}</strong> · {fields.occurredAt}{" "}
                {fields.approximateTime}
              </p>
              <p className="lf-preserve">{fields.details}</p>
              {fields.kind === "FOUND" && (
                <p>
                  {fields.custody === "IN_CARE" ? "In my care" : "Seen roaming"}
                </p>
              )}
              {fields.publicPhone && <p>Public contact: {fields.phone}</p>}
              {fields.reward && <p>Reward: {fields.reward}</p>}
              <div className="lf-photos">
                {photoIds.map((id) => (
                  <img
                    key={id}
                    src={`/api/images/${id}?size=thumb`}
                    alt="Selected profile photo"
                  />
                ))}
                {previews.map((url, i) => (
                  <img src={url} key={url} alt={`Uploaded photo ${i + 1}`} />
                ))}
              </div>
              <p className="lf-note">
                Only the details shown above will be published. Microchip
                numbers, health records and private profile locations are not
                copied. Your email is private.
              </p>
              <label className="lf-check">
                <input
                  type="checkbox"
                  required
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                I reviewed these public details, have permission to use these
                photos, and agree to publish this report.
              </label>
              <div className="button-row">
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => {
                    setReview(false);
                    setConsent(false);
                  }}
                >
                  Edit details
                </button>
                <button className="button primary" disabled={busy || !consent}>
                  {busy
                    ? "Saving…"
                    : meta.user
                      ? "Publish report"
                      : "Save and verify email"}
                </button>
              </div>
            </>
          ) : (
            <>
              {fields.kind === "MISSING" && (
                <label>
                  Pet
                  <select
                    required
                    value={fields.petId}
                    onChange={(e) =>
                      choose(pets.find((p) => p.id === e.target.value))
                    }
                  >
                    <option value="">Choose your pet</option>
                    {pets.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {!meta.user && (
                <label>
                  Your email{" "}
                  <small>Private · used to verify and manage this report</small>
                  <input
                    type="email"
                    required
                    value={fields.email}
                    onChange={(e) => set("email", e.target.value)}
                    maxLength={254}
                  />
                </label>
              )}
              <div className="lf-two">
                <label>
                  Pet name {fields.kind === "FOUND" && "(if known)"}
                  <input
                    value={fields.petName}
                    onChange={(e) => set("petName", e.target.value)}
                    maxLength={60}
                  />
                </label>
                <label>
                  Species
                  <select
                    value={fields.species}
                    onChange={(e) => set("species", e.target.value)}
                  >
                    <option value="CAT">Cat</option>
                    <option value="DOG">Dog</option>
                  </select>
                </label>
                <label>
                  Breed (optional)
                  <input
                    value={fields.breed}
                    onChange={(e) => set("breed", e.target.value)}
                    maxLength={100}
                  />
                </label>
                <label>
                  Colour (optional)
                  <input
                    value={fields.colour}
                    onChange={(e) => set("colour", e.target.value)}
                    maxLength={80}
                  />
                </label>
                <label>
                  {fields.kind === "MISSING"
                    ? "Missing since"
                    : "Found / seen on"}
                  <input
                    type="date"
                    required
                    max={new Date().toISOString().slice(0, 10)}
                    value={fields.occurredAt}
                    onChange={(e) => set("occurredAt", e.target.value)}
                  />
                </label>
                <label>
                  Approximate time (optional)
                  <input
                    value={fields.approximateTime}
                    onChange={(e) => set("approximateTime", e.target.value)}
                    maxLength={60}
                  />
                </label>
              </div>
              <label>
                {fields.kind === "MISSING"
                  ? "Last seen locality"
                  : "Found / seen locality"}
                <input
                  required
                  minLength={2}
                  maxLength={160}
                  value={fields.locality}
                  onChange={(e) => set("locality", e.target.value)}
                  placeholder="Town, neighbourhood or landmark; avoid a home address"
                />
              </label>
              {fields.kind === "FOUND" && (
                <label>
                  Pet’s situation
                  <select
                    value={fields.custody}
                    onChange={(e) => set("custody", e.target.value)}
                  >
                    <option value="IN_CARE">Currently in my care</option>
                    <option value="ROAMING">Seen roaming</option>
                  </select>
                </label>
              )}
              <label>
                Details and identifying features
                <textarea
                  required
                  minLength={10}
                  maxLength={2000}
                  rows={5}
                  value={fields.details}
                  onChange={(e) => set("details", e.target.value)}
                  placeholder="Collar, markings, temperament, and useful approach instructions. Keep some identifying details private to help check ownership."
                />
              </label>
              <label>
                Contact number {fields.kind === "FOUND" && "(optional)"}
                <input
                  type="tel"
                  required={fields.kind === "MISSING"}
                  value={fields.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  maxLength={40}
                />
              </label>
              <label className="lf-check">
                <input
                  type="checkbox"
                  required={fields.kind === "MISSING"}
                  checked={fields.publicPhone}
                  onChange={(e) => set("publicPhone", e.target.checked)}
                />
                Show my contact number publicly on this report
              </label>
              {fields.kind === "MISSING" && (
                <label>
                  Possible reward (optional)
                  <input
                    maxLength={160}
                    value={fields.reward}
                    onChange={(e) => set("reward", e.target.value)}
                    placeholder="e.g. Reward offered · contact owner"
                  />
                </label>
              )}
              <fieldset>
                <legend>Pet photos · one or two in total</legend>
                {pet && (
                  <div className="lf-photo-choices">
                    {pet.images.map((p) => (
                      <label key={p.id}>
                        <img
                          src={`/api/images/${p.id}?size=thumb`}
                          alt={`${pet.name} profile photo`}
                        />
                        <span>
                          <input
                            type="checkbox"
                            checked={photoIds.includes(p.id)}
                            onChange={(e) =>
                              setPhotoIds((ids) =>
                                e.target.checked
                                  ? [...ids, p.id]
                                  : ids.filter((id) => id !== p.id),
                              )
                            }
                          />{" "}
                          Use this photo
                        </span>
                      </label>
                    ))}
                  </div>
                )}
                <label>
                  Upload photos
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={(e) => setFiles(Array.from(e.target.files || []))}
                  />
                  <small>
                    Maximum two photos total, 10 MB each. Location metadata is
                    removed.
                  </small>
                </label>
                {previews.length > 0 && (
                  <div className="lf-photos">
                    {previews.map((url, i) => (
                      <img
                        key={url}
                        src={url}
                        alt={`Selected upload ${i + 1}`}
                      />
                    ))}
                  </div>
                )}
              </fieldset>
              {fields.kind === "FOUND" && (
                <label className="lf-check">
                  <input
                    type="checkbox"
                    checked={fields.photoReuse}
                    onChange={(e) => set("photoReuse", e.target.checked)}
                  />
                  After reunion, allow the owner to copy these photos into their
                  Petish profile
                </label>
              )}
              <label className="lf-honey" aria-hidden="true">
                Website
                <input
                  tabIndex={-1}
                  autoComplete="off"
                  value={fields.website}
                  onChange={(e) => set("website", e.target.value)}
                />
              </label>
              <button className="button primary">Preview public report</button>
            </>
          )}
        </form>
      )}
    </>
  );
}
function Detail({ id, meta }: { id: string; meta: Meta }) {
  const [r, setR] = useState<Report | null>(null),
    [error, setError] = useState(""),
    [mode, setMode] = useState(""),
    [flag, setFlag] = useState(""),
    [message, setMessage] = useState("");
  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const d = await api<Report>(`/${id}`);
        if (alive) {
          setR(d);
          setError("");
        }
      } catch (e) {
        if (alive) {
          setR(null);
          setError((e as Error).message);
        }
      }
    }
    void load();
    const t = setInterval(load, 30000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [id]);
  return (
    <>
      <Link className="back-link" href="/lost-found">
        <ArrowLeft size={16} />
        All reports
      </Link>
      {error ? (
        <section className="lf-empty">
          <h1>Report unavailable.</h1>
          <p role="status">{error}</p>
        </section>
      ) : !r ? (
        <p role="status">Loading report…</p>
      ) : (
        <>
          <div className="lf-detail-head">
            <div>
              <span className={`lf-badge ${r.kind.toLowerCase()}`}>
                {r.kind === "MISSING" ? "Missing pet" : "Found pet"}
              </span>
              <h1>{title(r)}</h1>
              <p>
                <MapPin size={18} />
                {r.locality} · {when(r.occurredAt)} {r.approximateTime}
              </p>
            </div>
            <button
              className="button primary"
              onClick={() => setMode("response")}
            >
              {r.kind === "MISSING"
                ? "Seen or found this pet?"
                : "This may be my pet"}
            </button>
          </div>
          <div className="lf-detail-grid">
            <section className="lf-panel">
              <div className="lf-photos">
                {r.photos.map((p) => (
                  <img
                    key={p.id}
                    src={p.url}
                    alt={r.petName || "Reported pet"}
                  />
                ))}
              </div>
              <h2>What to look for</h2>
              <p>
                {r.species} · {r.breed || "Breed unknown"} ·{" "}
                {r.colour || "Colour not recorded"}
              </p>
              <p className="lf-preserve">{r.details}</p>
              {r.kind === "FOUND" && (
                <p>
                  <strong>
                    {r.custody === "IN_CARE"
                      ? "Currently in finder’s care"
                      : "Seen roaming"}
                  </strong>
                </p>
              )}
              {r.reward && (
                <p>
                  <strong>Possible reward:</strong> {r.reward}
                </p>
              )}
            </section>
            <aside
              className="lf-panel"
              aria-label="Contact and report information"
            >
              <h2>Help make a connection</h2>
              <button
                className="button secondary"
                onClick={async () => {
                  try {
                    const url = location.origin + "/lost-found/" + r.id;
                    if (navigator.share)
                      await navigator.share({ title: title(r), url });
                    else {
                      await navigator.clipboard.writeText(url);
                      setMessage("Public report link copied.");
                    }
                  } catch (e) {
                    if ((e as Error).name !== "AbortError")
                      setMessage(
                        "Could not share automatically. Copy this page’s address from your browser.",
                      );
                  }
                }}
              >
                Share public report
              </button>
              {r.phone ? (
                <p>
                  Public contact: <strong>{r.phone}</strong>
                </p>
              ) : (
                <p>No public phone number. Send a private response below.</p>
              )}
              <p>
                Responses go privately to the report manager. A possible
                sighting is not a confirmed match.
              </p>
              <p>
                Before returning a pet, compare older photos and private
                identifying details.
              </p>
              <button className="text-button" onClick={() => setMode("flag")}>
                Report a concern
              </button>
            </aside>
          </div>
          {mode === "response" && <ResponseForm report={r} meta={meta} />}{" "}
          {mode === "flag" && (
            <form
              className="lf-panel lf-form"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  const d = await api<{ message: string }>("/flag", {
                    id,
                    reason: flag,
                  });
                  setMessage(d.message);
                  setMode("");
                } catch (e) {
                  setMessage((e as Error).message);
                }
              }}
            >
              <h2>Report a concern</h2>
              <label>
                What should a moderator review?
                <textarea
                  required
                  minLength={10}
                  maxLength={1000}
                  value={flag}
                  onChange={(e) => setFlag(e.target.value)}
                />
              </label>
              <button className="button secondary">Submit concern</button>
            </form>
          )}
          {message && <p role="status">{message}</p>}
        </>
      )}
    </>
  );
}
function ResponseForm({ report, meta }: { report: Report; meta: Meta }) {
  const [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="lf-panel lf-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const f = new FormData(e.currentTarget);
        const data = new FormData();
        data.set(
          "data",
          JSON.stringify({
            kind: report.kind === "FOUND" ? "CLAIM" : String(f.get("kind")),
            email: String(f.get("email")),
            phone: String(f.get("phone") || ""),
            locality: String(f.get("locality")),
            occurredAt: String(f.get("occurredAt")),
            details: String(f.get("details")),
            consent: f.get("consent") === "on",
            website: String(f.get("website") || ""),
          }),
        );
        for (const p of f.getAll("photos"))
          if (p instanceof File && p.size) data.append("photos", p);
        try {
          const d = await api<{ message: string }>(
            `/${report.id}/responses`,
            data,
          );
          setMessage(d.message);
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>
        {report.kind === "FOUND"
          ? "Send a private claim"
          : "Tell the owner what you saw"}
      </h2>
      <LocalMail meta={meta} />
      {message ? (
        <p role="status">{message}</p>
      ) : (
        <>
          {report.kind === "MISSING" && (
            <label>
              What happened?
              <select name="kind">
                <option value="SEEN">I saw a similar pet</option>
                <option value="IN_CARE">A similar pet is in my care</option>
              </select>
            </label>
          )}
          <label>
            Your email{" "}
            <small>Private to the report manager · verification required</small>
            <input
              name="email"
              type="email"
              required
              maxLength={254}
              defaultValue={meta.user?.email || ""}
            />
          </label>
          <label>
            Contact number (optional)
            <input name="phone" type="tel" maxLength={40} />
          </label>
          <label>
            {report.kind === "FOUND"
              ? "Where your pet went missing"
              : "Where was the pet seen / found?"}
            <input name="locality" required minLength={2} maxLength={160} />
          </label>
          <label>
            {report.kind === "FOUND"
              ? "Date your pet went missing"
              : "When was it seen / found?"}
            <input
              name="occurredAt"
              type="date"
              required
              max={new Date().toISOString().slice(0, 10)}
            />
          </label>
          <label>
            {report.kind === "FOUND"
              ? "Why you think this is your pet"
              : "Details of the possible sighting"}
            <textarea
              name="details"
              required
              minLength={10}
              maxLength={2000}
              rows={4}
            />
          </label>
          <label>
            {report.kind === "FOUND"
              ? "Older photos to help establish ownership (optional)"
              : "Photos of the pet you saw (optional)"}
            <input
              name="photos"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
            />
            <small>Up to two photos, 10 MB each.</small>
          </label>
          <label className="lf-honey" aria-hidden="true">
            Website
            <input name="website" tabIndex={-1} autoComplete="off" />
          </label>
          <label className="lf-check">
            <input type="checkbox" name="consent" required />I have permission
            to share these photos and contact details privately with the report
            manager.
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="button primary" disabled={busy}>
            {busy ? "Sending…" : "Send private response"}
          </button>
        </>
      )}
    </form>
  );
}
function Manager({ meta, id }: { meta: Meta; id: string }) {
  const [token, setToken] = useState(""),
    [reports, setReports] = useState<Report[]>([]),
    [notifications, setNotifications] = useState<Notice[]>([]),
    [r, setR] = useState<Report | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [reason, setReason] = useState("REUNITED"),
    [claimId, setClaimId] = useState("");
  const load = useCallback(
    async (currentToken: string) => {
      try {
        if (id || currentToken)
          setR(
            await api<Report>("/manage", {
              id: id || undefined,
              token: currentToken,
              action: "view",
            }),
          );
        else if (meta.user) {
          const d = await api<{ reports: Report[]; notifications: Notice[] }>(
            "/mine",
          );
          setReports(d.reports);
          setNotifications(d.notifications);
        }
      } catch (e) {
        setMessage((e as Error).message);
      }
    },
    [id, meta.user],
  );
  useEffect(() => {
    setR(null);
    const t = location.hash.slice(1);
    setToken(t);
    void load(t);
    const handler = () => {
      setR(null);
      const updated = location.hash.slice(1);
      setToken(updated);
      void load(updated);
    };
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, [load]);
  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    setMessage("");
    try {
      const updated = await api<Report>("/manage", {
        id: r?.id,
        token,
        action,
        ...extra,
      });
      setR(updated);
      setMessage("Report updated.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <span className="eyebrow">YOUR REPORTS, RESPONSES AND HISTORY</span>
      <h1>Keep the story together.</h1>
      <LocalMail meta={meta} />
      {message && (
        <p role="status" className="lf-note">
          {message}
        </p>
      )}
      {r ? (
        <>
          <Link className="back-link" href="/lost-found/manage">
            All my reports
          </Link>
          <section className="lf-panel">
            <span className="lf-badge">{state(r)}</span>
            <h2>{title(r)}</h2>
            <p>
              {r.locality} · {when(r.occurredAt)}
            </p>
            <div className="lf-photos">
              {r.photos.map((p) => (
                <PrivatePhoto
                  id={p.id}
                  token={token}
                  key={p.id}
                  alt="Report photo"
                />
              ))}
            </div>
            <p className="lf-preserve">{r.details}</p>
            {state(r) === "OPEN" && (
              <p className="lf-note">
                Confirm this report is still active when reminded after 30 days.
                It leaves the public board after 60 days without confirmation;
                your history stays here.
              </p>
            )}
            {r.closureReason && <p>Closed: {r.closureReason.toLowerCase()}</p>}
            <div className="button-row">
              {r.state === "PENDING" ? (
                <button
                  disabled={busy}
                  className="button primary"
                  onClick={() => void act("publish")}
                >
                  Verify email and publish report
                </button>
              ) : r.state !== "HIDDEN" ? (
                <button
                  disabled={busy}
                  className="button secondary"
                  onClick={() => void act("renew")}
                >
                  {state(r) === "OPEN"
                    ? "Confirm still active"
                    : "Reopen report"}
                </button>
              ) : (
                <p>
                  Hidden by a moderator. Contact the site operator for review.
                </p>
              )}
              {r.state === "OPEN" && (
                <Link className="text-link" href={`/lost-found/${r.id}`}>
                  View public report
                </Link>
              )}
            </div>
          </section>
          <form
            className="lf-panel lf-form"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void act("update", {
                details: f.get("details"),
                locality: f.get("locality"),
                phone: f.get("phone"),
                publicPhone: f.get("publicPhone") === "on",
                reward: f.get("reward") || "",
              });
            }}
            key={r.updatedAt}
          >
            <h2>Update report details</h2>
            <label>
              Locality
              <input
                name="locality"
                required
                minLength={2}
                maxLength={160}
                defaultValue={r.locality}
              />
            </label>
            <label>
              Details
              <textarea
                name="details"
                required
                minLength={10}
                maxLength={2000}
                defaultValue={r.details}
                rows={4}
              />
            </label>
            <label>
              Contact number
              <input name="phone" maxLength={40} defaultValue={r.phone || ""} />
            </label>
            <label className="lf-check">
              <input
                type="checkbox"
                name="publicPhone"
                defaultChecked={r.publicPhone}
              />
              Display contact number publicly
            </label>
            {r.kind === "MISSING" && (
              <label>
                Reward
                <input
                  name="reward"
                  maxLength={160}
                  defaultValue={r.reward || ""}
                />
              </label>
            )}
            <button className="button secondary" disabled={busy}>
              Save report details
            </button>
          </form>
          <section className="lf-panel">
            <h2>Private responses</h2>
            <p>
              Only you can see these responses. Compare evidence and contact the
              person privately.
            </p>
            {r.responses?.length ? (
              r.responses.map((reply) => (
                <article className="lf-reply" key={reply.id}>
                  <strong>
                    {reply.kind === "CLAIM"
                      ? "Possible owner"
                      : reply.kind === "IN_CARE"
                        ? "Pet in finder’s care"
                        : "Possible sighting"}
                  </strong>
                  <p>
                    {reply.locality} · {when(reply.occurredAt)}
                  </p>
                  <p className="lf-preserve">{reply.details}</p>
                  <p>Verified email: {reply.email}</p>
                  {reply.phone && <p>Phone: {reply.phone}</p>}
                  <div className="lf-photos">
                    {reply.photos.map((p) => (
                      <PrivatePhoto
                        key={p.id}
                        id={p.id}
                        token={token}
                        alt="Private response photo"
                      />
                    ))}
                  </div>
                </article>
              ))
            ) : (
              <p>No verified responses yet.</p>
            )}
          </section>
          <form
            className="lf-panel lf-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (
                confirm(
                  "Close this case and remove its public photos and contact details? Your private history will remain.",
                )
              )
                void act("close", { reason, claimId: claimId || undefined });
            }}
          >
            <h2>Close this case</h2>
            <label>
              Outcome
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              >
                <option value="REUNITED">Reunited</option>
                <option value="SAFE">Located and safe</option>
                <option value="DUPLICATE">Duplicate report</option>
                <option value="WITHDRAWN">Withdrawn</option>
                <option value="OTHER">Other</option>
              </select>
            </label>
            {r.kind === "FOUND" && reason === "REUNITED" && (
              <label>
                Invite the reunited owner to Petish
                <select
                  value={claimId}
                  onChange={(e) => setClaimId(e.target.value)}
                >
                  <option value="">
                    No invitation / no verified claim yet
                  </option>
                  {r.responses
                    ?.filter((x) => x.kind === "CLAIM")
                    .map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.email}
                      </option>
                    ))}
                </select>
                <small>
                  Choose a verified claimant to receive a private invitation to
                  create or link their pet profile.
                </small>
              </label>
            )}
            <button className="button primary" disabled={busy}>
              Close case and retain history
            </button>
          </form>
        </>
      ) : (
        <>
          {meta.user && (
            <>
              <section className="lf-panel">
                <h2>
                  <Bell size={20} /> Notifications
                </h2>
                {notifications.length ? (
                  notifications.map((n) => (
                    <p key={n.id}>
                      <Link href={`/lost-found/manage?id=${n.reportId}`}>
                        {!n.readAt && "New · "}
                        {n.subject}
                      </Link>
                    </p>
                  ))
                ) : (
                  <p>No notifications yet.</p>
                )}
                {notifications.some((n) => !n.readAt) && (
                  <button
                    className="text-button"
                    onClick={async () => {
                      await api("/notifications", {});
                      void load(token);
                    }}
                  >
                    Mark all read
                  </button>
                )}
              </section>
              <div className="lf-section-heading">
                <h2>My reports and history</h2>
                <Link
                  className="button secondary"
                  href="/lost-found/new?kind=FOUND"
                >
                  New report
                </Link>
              </div>
              {reports.length ? (
                <div className="lf-grid">
                  {reports.map((r) => (
                    <Card key={r.id} r={r} manager />
                  ))}
                </div>
              ) : (
                <p>No reports yet.</p>
              )}
            </>
          )}
          <form
            className="lf-panel lf-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                const d = await api<{ message: string }>("/request-link", {
                  email: new FormData(e.currentTarget).get("email"),
                });
                setMessage(d.message);
              } catch (e) {
                setMessage((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <h2>Posted without an account?</h2>
            <p>
              Request fresh management links or resend verification for a
              private response. Check your inbox; links are never displayed
              here.
            </p>
            <label>
              Your email
              <input name="email" type="email" required maxLength={254} />
            </label>
            <button className="button secondary" disabled={busy}>
              Email my management links
            </button>
          </form>
        </>
      )}
    </>
  );
}
function Verify({ meta }: { meta: Meta }) {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <section className="lf-panel">
      <h1>Verify your private response.</h1>
      <p>
        Confirm this email address so the report manager can receive your
        sighting or claim.
      </p>
      <LocalMail meta={meta} />
      <button
        className="button primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const d = await api<{ message: string }>("/verify", {
              token: location.hash.slice(1),
            });
            setMessage(d.message);
          } catch (e) {
            setMessage((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        Verify and send response
      </button>
      {message && <p role="status">{message}</p>}
      <Link className="text-link" href="/lost-found">
        Back to the board
      </Link>
    </section>
  );
}
function Reunited({ meta }: { meta: Meta }) {
  const [data, setData] = useState<{
      species: string;
      breed: string;
      colour: string;
      photoReuse: boolean;
      importedPetId: string | null;
    } | null>(null),
    [pets, setPets] = useState<Pet[]>([]),
    [message, setMessage] = useState(""),
    [result, setResult] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    try {
      setData(
        await api("/import", {
          token: location.hash.slice(1),
          action: "preview",
        }),
      );
      const r = await fetch("/api/pets");
      if (r.ok) setPets(await r.json());
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  useEffect(() => {
    if (meta.user) void load();
  }, [meta.user]);
  return (
    <section className="lf-panel lf-form">
      <span className="eyebrow">A NEW CHAPTER TOGETHER</span>
      <h1>Welcome home.</h1>
      <p>
        Add your reunited pet to Petish, or link this report to a profile you
        already own. Found-report details are suggestions for you to review.
      </p>
      {!meta.user ? (
        <>
          <p>
            Sign in or register using the email that received this invitation.
            Keep this page open, then return after verifying your account.
          </p>
          <Link className="button primary" target="_blank" href="/login">
            Sign in / create an account
          </Link>
          <button
            className="button secondary"
            onClick={() => location.reload()}
          >
            I’ve signed in
          </button>
        </>
      ) : !data ? (
        <button className="button secondary" onClick={() => void load()}>
          Check my invitation
        </button>
      ) : result ? (
        <Link className="button primary" href={`/app/pets/${result}`}>
          Open pet profile
        </Link>
      ) : (
        <form
          className="lf-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const f = new FormData(e.currentTarget);
            try {
              const d = await api<{ petId: string; message: string }>(
                "/import",
                {
                  token: location.hash.slice(1),
                  name: f.get("name"),
                  petId: f.get("petId") || undefined,
                  confirm: f.get("confirm") === "on",
                  copyPhotos: f.get("photos") === "on",
                },
              );
              setResult(d.petId);
              setMessage(d.message);
            } catch (e) {
              setMessage((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <p>
            {data.species} · {data.breed || "Breed unknown"} ·{" "}
            {data.colour || "Colour unknown"}
          </p>
          <label>
            Pet’s name
            <input name="name" required maxLength={60} />
          </label>
          <label>
            Create or link
            <select name="petId">
              <option value="">Create a new private profile</option>
              {pets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          {data.photoReuse && (
            <label className="lf-check">
              <input type="checkbox" name="photos" />
              Copy the finder’s photos, with their permission (only into an
              empty photo gallery)
            </label>
          )}
          <label className="lf-check">
            <input type="checkbox" name="confirm" required />I am this pet’s
            owner and have reviewed the details. Linking an existing profile
            will not overwrite its details.
          </label>
          <button className="button primary" disabled={busy}>
            Save pet profile
          </button>
        </form>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
function Moderation({ meta }: { meta: Meta }) {
  const [data, setData] = useState<{
      flags: { id: string; reason: string; report: Report }[];
      reports: Report[];
    } | null>(null),
    [error, setError] = useState("");
  async function load() {
    try {
      setData(await api("/moderation"));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    if (meta.moderator) void load();
  }, [meta.moderator]);
  async function act(id: string, action: string) {
    try {
      await api("/moderation", { id, action });
      void load();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (!meta.moderator) return <p>Moderator access required.</p>;
  return (
    <>
      <h1>Review the board.</h1>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <h2>Reported concerns</h2>
      {data?.flags.map((f) => (
        <section className="lf-panel" key={f.id}>
          <h3>{title(f.report)}</h3>
          <p>{f.reason}</p>
          <div className="button-row">
            <button
              className="button secondary"
              onClick={() => void act(f.report.id, "hide")}
            >
              Hide report
            </button>
            <button
              className="text-button"
              onClick={() => void act(f.id, "dismiss")}
            >
              Dismiss concern
            </button>
          </div>
        </section>
      ))}
      {!data?.flags.length && <p>No open concerns.</p>}
      <h2>Recent open and hidden reports</h2>
      {data?.reports.map((r) => (
        <section className="lf-panel" key={r.id}>
          <span className="lf-badge">{r.state}</span>
          <h3>{title(r)}</h3>
          <p>{r.locality}</p>
          <p className="lf-preserve">{r.details}</p>
          <div className="lf-photos">
            {r.photos.map((p) => (
              <img
                key={p.id}
                src={`${base}/photos/${p.id}`}
                alt="Report under review"
              />
            ))}
          </div>
          <button
            className="button secondary"
            onClick={() =>
              void act(r.id, r.state === "HIDDEN" ? "restore" : "hide")
            }
          >
            {r.state === "HIDDEN" ? "Restore report" : "Hide report"}
          </button>
        </section>
      ))}
    </>
  );
}
