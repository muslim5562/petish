"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  PawPrint,
  House,
  UserRound,
  Plus,
  ArrowUpRight,
  ArrowLeft,
  Camera,
  LockKeyhole,
  Globe,
  ChevronRight,
  Check,
  Heart,
  LogOut,
  X,
  ImagePlus,
  Archive,
  Mail,
  Search,
  MapPin,
  LoaderCircle,
  Ellipsis,
  Sun,
  Copy,
  ExternalLink,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { ageLabel } from "@/lib/pet-rules";
import HealthSpace from "./health-space";
import PublicCard, { type PublicPet } from "./public-card";
type Photo = { id: string; view: string };
type Pet = {
  id: string;
  publicId: string;
  name: string;
  species: "CAT" | "DOG";
  sex: string;
  breed: string | null;
  mixedBreed: boolean;
  birthDate: string | null;
  birthPrecision: string;
  ageEntry: string | null;
  colour: string | null;
  markings: string | null;
  microchip: string | null;
  neutered: string;
  careType: "INHOUSE" | "CARE_STRAY";
  normalLocation: string | null;
  area: string | null;
  description: string | null;
  visibility: string;
  status: string;
  mainImageId: string | null;
  images: Photo[];
  createdAt: string;
};
type User = { id: string; name: string; email: string };
type Activity = {
  id: string;
  action: string;
  createdAt: string;
  petId: string | null;
};
async function api(url: string, method = "GET", body?: unknown) {
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
  if (!r.ok)
    throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}
function IconPhoto({ pet, thumb = false }: { pet: Pet; thumb?: boolean }) {
  return pet.mainImageId ? (
    <img
      src={`/api/images/${pet.mainImageId}${thumb ? "?size=thumb" : ""}`}
      alt={pet.name}
    />
  ) : (
    <div className={`photo-placeholder ${pet.species.toLowerCase()}`}>
      <PawPrint size={54} />
      <span>A little camera shy</span>
    </div>
  );
}
function Status({ pet }: { pet: Pet }) {
  return (
    <span className={`status ${pet.visibility === "PUBLIC" ? "public" : ""}`}>
      {pet.visibility === "PUBLIC" ? (
        <Globe size={12} />
      ) : (
        <LockKeyhole size={12} />
      )}{" "}
      {pet.status === "REHOMED"
        ? "Transferred to new owner"
        : pet.status === "DECEASED"
          ? "In loving memory"
          : pet.status === "ARCHIVED"
            ? "Archived"
            : pet.visibility === "PUBLIC"
              ? "Public"
              : "Private"}
    </span>
  );
}
function PetCard({ pet }: { pet: Pet }) {
  return (
    <Link className="pet-card" href={`/app/pets/${pet.id}`}>
      <div className="pet-card-photo">
        <IconPhoto pet={pet} thumb />
        <Status pet={pet} />
        <span className="card-arrow">
          <ArrowUpRight size={19} />
        </span>
      </div>
      <div className="pet-card-copy">
        <div>
          <h3>{pet.name}</h3>
          <span>{pet.breed || (pet.species === "DOG" ? "Dog" : "Cat")}</span>
        </div>
        <span className="pet-age">
          {ageLabel(pet.birthDate, pet.birthPrecision)}
        </span>
      </div>
    </Link>
  );
}
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog ref={ref} className="modal" onCancel={onClose}>
      <div className="modal-heading">
        <h2>{title}</h2>
        <button
          aria-label="Close dialog"
          className="icon-button"
          onClick={onClose}
        >
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export default function PetishApp({
  user: initialUser,
  demo,
  phonePreview = false,
}: {
  user: User;
  demo: boolean;
  phonePreview?: boolean;
}) {
  const router = useRouter(),
    pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const section = segments[1] || "home",
    id = segments[2],
    editing = segments[3] === "edit";
  const [pets, setPets] = useState<Pet[]>([]),
    [user, setUser] = useState(initialUser),
    [activity, setActivity] = useState<Activity[]>([]),
    [deletion, setDeletion] = useState<{ requestedAt: string } | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [filter, setFilter] = useState("all"),
    [search, setSearch] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [modal, setModal] = useState<"photos" | "privacy" | "lifecycle" | null>(
      null,
    ),
    [preview, setPreview] = useState<PublicPet | null>(null),
    [busy, setBusy] = useState(false);
  const pet = pets.find((p) => p.id === id);
  async function refresh() {
    const [list, account] = await Promise.all([
      api("/api/pets"),
      api("/api/account"),
    ]);
    setPets(list);
    setUser(account.user);
    setActivity(account.activity);
    setDeletion(account.deletionRequest);
  }
  useEffect(() => {
    let active = true;
    Promise.all([api("/api/pets"), api("/api/account")])
      .then(([list, account]) => {
        if (active) {
          setPets(list);
          setUser(account.user);
          setActivity(account.activity);
          setDeletion(account.deletionRequest);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [pathname]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  async function action(fn: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError("");
    try {
      await fn();
      await refresh();
      setToast(message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function privacy() {
    if (!pet) return;
    setBusy(true);
    try {
      setPreview(await api(`/api/pets/${pet.id}/preview`));
      setModal("privacy");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const careStrays = pets.filter(
    (p) =>
      p.careType === "CARE_STRAY" &&
      !["REHOMED", "DECEASED"].includes(p.status),
  );
  const activePets = pets.filter((p) => p.status === "ACTIVE");
  const selectedPets = pets.filter(
    (p) =>
      (filter === "rehomed"
        ? p.status === "REHOMED"
        : filter === "deceased"
          ? p.status === "DECEASED"
          : filter === "archived"
            ? p.status === "ARCHIVED"
            : p.status === "ACTIVE" &&
              (filter === "all" || p.species === filter)) &&
      `${p.name} ${p.breed || ""}`.toLowerCase().includes(search.toLowerCase()),
  );
  const nav = [
    { name: "Home", href: "/app", icon: House, active: section === "home" },
    {
      name: "My pets",
      href: "/app/pets",
      icon: PawPrint,
      active: section === "pets",
    },
    {
      name: "Profile",
      href: "/app/profile",
      icon: UserRound,
      active: section === "profile",
    },
  ];
  return (
    <div className="app-shell">
      {phonePreview && (
        <div className="phone-preview-notice">
          Shared phone-testing demo · Use sample photos and notes only.
        </div>
      )}
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar" aria-label="Account navigation">
        <Link href="/app" className="brand">
          <PawPrint />
          petish<span>®</span>
        </Link>
        <span className="sidebar-label">YOUR LITTLE WORLD</span>
        <nav>
          {nav.map((n) => (
            <Link
              href={n.href}
              key={n.href}
              className={n.active ? "active" : ""}
            >
              <n.icon size={21} />
              {n.name}
              {n.name === "My pets" && (
                <span className="nav-count">{activePets.length}</span>
              )}
            </Link>
          ))}
        </nav>
        <button
          className="sidebar-signout"
          onClick={async () => {
            const result = await authClient.signOut();
            if (result.error) {
              setError("Could not sign out. Please try again.");
              return;
            }
            router.replace("/login");
            router.refresh();
          }}
        >
          <LogOut size={20} /> Sign out
        </button>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <Heart size={23} />
            <p>
              Small moments.
              <br />
              <strong>A lifetime of love.</strong>
            </p>
          </div>
          <Link href="/app/profile" className="owner-chip">
            <span className="avatar">{user.name.slice(0, 1)}</span>
            <span>
              <strong>{user.name}</strong>
              <small>Pet parent</small>
            </span>
            <ChevronRight size={16} />
          </Link>
        </div>
      </aside>
      <div className="app-body">
        <header className="topbar">
          <Link href="/app" className="brand mobile-brand">
            <PawPrint />
            petish
          </Link>
          <span className="desktop-breadcrumb">
            Your space <ChevronRight size={14} />
            <strong>
              {section === "home"
                ? "Home"
                : section === "profile"
                  ? "Profile"
                  : "My pets"}
            </strong>
          </span>
          <div className="topbar-right">
            {demo && <span className="demo-pill">Demo space</span>}
            <Link
              href="/app/profile"
              aria-label="Your profile"
              className="avatar small"
            >
              {user.name.slice(0, 1)}
            </Link>
          </div>
        </header>
        <main className="main-content" id="main-content">
          {error && modal !== "lifecycle" && (
            <div className="error error-banner" role="alert">
              {error}
              <button
                className="icon-button"
                aria-label="Dismiss error"
                onClick={() => setError("")}
              >
                <X size={17} />
              </button>
            </div>
          )}
          {loading ? (
            <div className="loading">
              <LoaderCircle className="spin" /> Getting your pets together…
            </div>
          ) : section === "home" ? (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">
                    <Sun size={15} /> A LITTLE TIME FOR YOUR FAVOURITES
                  </span>
                  <h1>
                    Hello, {user.name.split(" ")[0]}
                    <span className="heading-dot">.</span>
                  </h1>
                  <p>Your favourite faces, all in one place.</p>
                </div>
                <Link className="button primary" href="/app/pets/new">
                  <Plus size={19} /> Add a pet
                </Link>
              </div>
              <section className="welcome-strip">
                <div className="welcome-copy">
                  <span className="eyebrow">THE BEST KIND OF COMPANY</span>
                  <h2>
                    Life’s better
                    <br />
                    with a little <em>fur.</em>
                  </h2>
                  <p>Keep their photos, quirks, and little details close.</p>
                  <Link
                    href={
                      activePets[0]
                        ? `/app/pets/${activePets[0].id}`
                        : "/app/pets/new"
                    }
                  >
                    {" "}
                    {activePets[0]
                      ? `Spend a moment with ${activePets[0].name}`
                      : "Meet your first pet"}{" "}
                    <ArrowUpRight size={18} />
                  </Link>
                </div>
                <div className="welcome-image">
                  {activePets[0] ? (
                    <IconPhoto pet={activePets[0]} />
                  ) : (
                    <img
                      src="/demo/golden-retriever.jpg"
                      alt="Golden retriever puppy"
                    />
                  )}
                  <div className="welcome-caption">
                    <Heart size={16} fill="currentColor" /> Your kind of family
                  </div>
                </div>
                <span className="welcome-decoration">
                  <PawPrint size={75} />
                </span>
              </section>
              <div className="section-heading">
                <div>
                  <h2>
                    My pets <span className="count">{activePets.length}</span>
                  </h2>
                  <p>A whole lot of personality.</p>
                </div>
                <Link href="/app/pets" className="text-link">
                  View all <ArrowUpRight size={17} />
                </Link>
              </div>
              <div className="pet-grid home-grid">
                {activePets.slice(0, 3).map((p) => (
                  <PetCard pet={p} key={p.id} />
                ))}
                {activePets.length < 3 && (
                  <Link href="/app/pets/new" className="add-pet-card">
                    <span>
                      <Plus size={26} />
                    </span>
                    <h3>
                      {activePets.length
                        ? "Room for one more?"
                        : "Let’s add your first pet."}
                    </h3>
                    <p>A name is all you need to start.</p>
                  </Link>
                )}
              </div>
              {careStrays.length > 0 && (
                <section aria-label="Care strays" className="care-strays-home">
                  <div className="section-heading">
                    <div>
                      <h2>
                        Care strays{" "}
                        <span className="count">{careStrays.length}</span>
                      </h2>
                      <p>The familiar faces you look out for.</p>
                    </div>
                  </div>
                  <div className="pet-grid">
                    {careStrays.map((p) => (
                      <PetCard pet={p} key={p.id} />
                    ))}
                  </div>
                </section>
              )}
              {activePets.length > 0 && (
                <section className="home-health-card">
                  <h2>A little care, kept together.</h2>
                  <p>
                    Visits, prescriptions, and the details you want to remember.
                  </p>
                  <div className="button-row">
                    {activePets.slice(0, 3).map((p) => (
                      <Link
                        key={p.id}
                        className="button secondary"
                        href={`/app/pets/${p.id}/health`}
                      >
                        {p.name}’s health <ArrowUpRight size={15} />
                      </Link>
                    ))}
                  </div>
                </section>
              )}
              <div className="home-lower">
                <section>
                  <div className="section-heading">
                    <h2>Little updates</h2>
                    <span className="eyebrow">RECENT ACTIVITY</span>
                  </div>
                  {activity.length ? (
                    activity.slice(0, 3).map((a) => (
                      <div className="activity" key={a.id}>
                        <span className="activity-icon">
                          <PawPrint size={18} />
                        </span>
                        <div>
                          <strong>{a.action}</strong>
                          <small>
                            {pets.find((p) => p.id === a.petId)?.name ||
                              "Your account"}{" "}
                            ·{" "}
                            {new Date(a.createdAt).toLocaleDateString(
                              undefined,
                              { month: "short", day: "numeric" },
                            )}
                          </small>
                        </div>
                        <Check size={16} />
                      </div>
                    ))
                  ) : (
                    <p className="empty-note">
                      Your pet’s story starts here. Add a pet to begin.
                    </p>
                  )}
                </section>
                <aside className="privacy-note">
                  <LockKeyhole size={24} />
                  <h3>Their world. Your choice.</h3>
                  <p>
                    Your pets start private. When you’re ready to share a
                    profile, you’ll see exactly what others will see.
                  </p>
                  <span>
                    Always in your hands <Heart size={14} />
                  </span>
                </aside>
              </div>
            </>
          ) : section === "pets" && id === "new" ? (
            <PetForm
              onSaved={async (p) => {
                await refresh();
                router.push(`/app/pets/${p.id}`);
                setToast(`${p.name} has a little home here.`);
              }}
            />
          ) : section === "pets" && id && pet && segments[3] === "health" ? (
            <HealthSpace
              key={pet.id}
              pet={pet}
              ownerId={user.id}
              ownerName={user.name}
              path={segments.slice(4)}
            />
          ) : section === "pets" && id && pet && editing ? (
            <PetForm
              pet={pet}
              onSaved={async (p) => {
                await refresh();
                router.push(`/app/pets/${p.id}`);
                setToast("Profile saved.");
              }}
            />
          ) : section === "pets" && id && pet ? (
            <>
              <Link className="back-link" href="/app/pets">
                <ArrowLeft size={17} /> All my pets
              </Link>
              <div className="pet-detail">
                <div className="detail-portrait">
                  <IconPhoto pet={pet} />
                  <button
                    className="button photo-edit"
                    onClick={() => setModal("photos")}
                  >
                    <Camera size={18} />{" "}
                    {pet.images.length ? "Edit photos" : "Add a photo"}
                  </button>
                </div>
                <div className="detail-intro">
                  <div className="detail-intro-top">
                    <Status pet={pet} />
                    <button
                      className="button secondary"
                      aria-label="Pet settings"
                      onClick={() => setModal("lifecycle")}
                    >
                      <Ellipsis size={18} /> Status
                    </button>
                  </div>
                  <span className="eyebrow">YOUR ONE OF A KIND</span>
                  <h1>
                    {pet.name}
                    <span className="heading-dot">.</span>
                  </h1>
                  <p className="detail-breed">
                    {pet.breed || (pet.species === "DOG" ? "Dog" : "Cat")}
                    {pet.mixedBreed ? " · Mixed breed" : ""}
                  </p>
                  <div className="identity-pills">
                    <span>{ageLabel(pet.birthDate, pet.birthPrecision)}</span>
                    <span>
                      {pet.sex === "UNKNOWN"
                        ? "Sex unknown"
                        : pet.sex === "MALE"
                          ? "Male"
                          : "Female"}
                    </span>
                  </div>
                  <p className="pet-story">
                    {pet.description ||
                      `Every little detail makes ${pet.name}, ${pet.name}. Add a short introduction to tell their story.`}
                  </p>
                  {pet.area && (
                    <p className="area">
                      <MapPin size={16} />
                      {pet.area}
                    </p>
                  )}
                  <div className="button-row">
                    <Link
                      className="button primary"
                      href={`/app/pets/${pet.id}/edit`}
                    >
                      Edit profile <ArrowUpRight size={17} />
                    </Link>
                    <button
                      className="button secondary"
                      onClick={privacy}
                      disabled={busy}
                    >
                      <Globe size={18} /> Visibility
                    </button>
                  </div>
                </div>
              </div>
              <div className="pet-health-link">
                <Link
                  className="button primary"
                  href={`/app/pets/${pet.id}/health`}
                >
                  <Heart size={19} /> Health record <ArrowUpRight size={17} />
                </Link>
              </div>
              <div className="detail-lower">
                <section className="detail-panel">
                  <div className="section-heading">
                    <h2>The little details</h2>
                    <Link
                      className="text-link"
                      href={`/app/pets/${pet.id}/edit`}
                    >
                      Edit
                    </Link>
                  </div>
                  <dl className="detail-facts">
                    <div>
                      <dt>Birthday</dt>
                      <dd>
                        {pet.birthDate
                          ? pet.birthPrecision === "EXACT"
                            ? new Date(pet.birthDate).toLocaleDateString(
                                undefined,
                                {
                                  day: "numeric",
                                  month: "long",
                                  year: "numeric",
                                },
                              )
                            : ageLabel(pet.birthDate, pet.birthPrecision)
                          : "Not recorded"}
                      </dd>
                    </div>
                    <div>
                      <dt>Care</dt>
                      <dd>
                        {pet.careType === "CARE_STRAY"
                          ? "Care stray"
                          : "Inhouse"}
                      </dd>
                    </div>
                    {pet.careType === "CARE_STRAY" && (
                      <div>
                        <dt>Normal location</dt>
                        <dd>{pet.normalLocation || "Not recorded"}</dd>
                      </div>
                    )}
                    <div>
                      <dt>Colour</dt>
                      <dd>{pet.colour || "Not recorded"}</dd>
                    </div>
                    <div>
                      <dt>Neutered / spayed</dt>
                      <dd>
                        {pet.neutered === "UNKNOWN"
                          ? "Unknown"
                          : pet.neutered === "YES"
                            ? "Yes"
                            : "No"}
                      </dd>
                    </div>
                    <div>
                      <dt>
                        Microchip <LockKeyhole size={12} />
                      </dt>
                      <dd>{pet.microchip || "Not recorded"}</dd>
                    </div>
                    {pet.markings && (
                      <div>
                        <dt>Distinguishing markings</dt>
                        <dd>{pet.markings}</dd>
                      </div>
                    )}
                  </dl>
                </section>
                <aside className="privacy-note">
                  <LockKeyhole size={24} />
                  <h3>
                    {pet.visibility === "PRIVATE"
                      ? "Just between you two."
                      : "A friendly introduction."}
                  </h3>
                  <p>
                    {pet.visibility === "PRIVATE"
                      ? "This pet’s profile is private. Only you can access it."
                      : "Only your pet’s public introduction and main photo are visible. Private details stay with you."}
                  </p>
                  <button className="text-link" onClick={privacy}>
                    Manage visibility <ArrowUpRight size={16} />
                  </button>
                </aside>
              </div>
            </>
          ) : section === "pets" && !id ? (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">YOUR KIND OF FAMILY</span>
                  <h1>
                    My pets<span className="heading-dot">.</span>
                  </h1>
                  <p>Different personalities. Same place in your heart.</p>
                </div>
                <Link className="button primary" href="/app/pets/new">
                  <Plus size={19} /> Add a pet
                </Link>
              </div>
              <div className="list-toolbar">
                <div
                  className="filter-tabs"
                  role="group"
                  aria-label="Filter pets"
                >
                  {[
                    ["all", "All pets"],
                    ["DOG", "Dogs"],
                    ["CAT", "Cats"],
                    ["archived", "Archived"],
                    ["rehomed", "Rehomed"],
                    ["deceased", "Deceased"],
                  ].map(([v, l]) => (
                    <button
                      key={v}
                      className={filter === v ? "selected" : ""}
                      onClick={() => setFilter(v)}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                <label className="search-box">
                  <Search size={17} />
                  <input
                    aria-label="Search your pets"
                    placeholder="Find a familiar face"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
              </div>
              <div className="pet-grid">
                {selectedPets.map((p) => (
                  <PetCard key={p.id} pet={p} />
                ))}
                {filter === "all" && !search && (
                  <Link href="/app/pets/new" className="add-pet-card">
                    <span>
                      <Plus size={26} />
                    </span>
                    <h3>Add a little personality.</h3>
                    <p>Make room for your next favourite face.</p>
                  </Link>
                )}
              </div>
              {selectedPets.length === 0 && (filter !== "all" || search) && (
                <div className="empty">
                  <PawPrint size={38} />
                  <h2>No little faces here yet.</h2>
                  <p>Try another filter or search.</p>
                </div>
              )}
            </>
          ) : section === "profile" ? (
            <Profile
              user={user}
              demo={demo}
              deletion={deletion}
              onUpdate={async () => {
                await refresh();
                setToast("Account updated.");
              }}
            />
          ) : (
            <div className="empty">
              <h1>This pet isn’t available.</h1>
              <Link href="/app/pets" className="button primary">
                Back to my pets
              </Link>
            </div>
          )}
          <footer className="app-footer">
            <span>For the ones who make a house a home.</span>
            <Link href="/install">Install on your phone</Link>
            <Link href="/credits">Photo credits</Link>
          </footer>
        </main>
      </div>
      <nav className="bottom-nav">
        {nav.map((n) => (
          <Link key={n.href} href={n.href} className={n.active ? "active" : ""}>
            <n.icon size={22} />
            <span>{n.name}</span>
          </Link>
        ))}
      </nav>
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
        </div>
      )}
      {modal === "photos" && pet && (
        <Modal title={`${pet.name}’s photos`} onClose={() => setModal(null)}>
          <PhotoManager pet={pet} onUpdate={refresh} />
        </Modal>
      )}
      {modal === "privacy" && preview && pet && (
        <Modal title="Their public introduction" onClose={() => setModal(null)}>
          <p className="modal-description">
            This is exactly what other people will see. Owner details,
            microchip, and exact birthday are never included.
          </p>
          <div className="preview-card">
            <PublicCard
              pet={preview}
              previewImage={
                pet.mainImageId ? `/api/images/${pet.mainImageId}` : undefined
              }
            />
          </div>
          <p className="fine-print">
            Anyone with the public link can view or save this page. Making it
            private prevents future access, but cannot recall saved copies.
          </p>
          {pet.visibility === "PUBLIC" && (
            <div className="button-row">
              <a
                className="button secondary"
                href={`/p/${pet.publicId}`}
                target="_blank"
                rel="noreferrer"
              >
                Open page <ExternalLink size={16} />
              </a>
              <button
                className="button secondary"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      `${location.origin}/p/${pet.publicId}`,
                    );
                    setToast("Public link copied.");
                  } catch {
                    setError(
                      "Copying is unavailable. Open the public page and copy its address.",
                    );
                  }
                }}
              >
                <Copy size={16} /> Copy link
              </button>
            </div>
          )}
          <button
            className="button primary full"
            disabled={busy || pet.status !== "ACTIVE"}
            onClick={() =>
              action(
                async () => {
                  await api(`/api/pets/${pet.id}/state`, "PATCH", {
                    visibility:
                      pet.visibility === "PUBLIC" ? "PRIVATE" : "PUBLIC",
                    confirmed: true,
                  });
                  setModal(null);
                },
                pet.visibility === "PUBLIC"
                  ? "Profile is now private."
                  : "Your pet’s public profile is ready.",
              )
            }
          >
            {pet.visibility === "PUBLIC" ? (
              <>
                <LockKeyhole size={17} /> Make private
              </>
            ) : (
              <>
                <Globe size={17} /> Confirm and publish
              </>
            )}
          </button>
          {pet.status !== "ACTIVE" && (
            <p className="fine-print">
              Archived and memorial profiles stay private.
            </p>
          )}
        </Modal>
      )}
      {modal === "lifecycle" && pet && (
        <Modal title={`${pet.name}’s status`} onClose={() => setModal(null)}>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <p className="modal-description">
            Archiving keeps the profile and photos, and removes it from your
            active pets. Memorial profiles also become private.
          </p>
          <div className="stack">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() =>
                action(
                  async () => {
                    await api(`/api/pets/${pet.id}/state`, "PATCH", {
                      status: pet.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE",
                    });
                    setModal(null);
                  },
                  pet.status === "ACTIVE" ? "Pet archived." : "Pet restored.",
                )
              }
            >
              <Archive size={18} />
              {pet.status === "ACTIVE"
                ? "Archive this pet"
                : "Restore to active pets"}
            </button>
            {pet.status !== "REHOMED" && pet.status !== "DECEASED" && (
              <div className="rehoming-controls">
                <label>
                  New owner’s Petish email
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="Their verified Petish account email"
                    maxLength={254}
                  />
                </label>
                <p className="fine-print">
                  Records a rehomed status after checking their account. Your
                  records stay in your account. If they do not have Petish,
                  share a PDF instead.
                </p>
                <Link
                  className="text-link"
                  href={`/app/pets/${pet.id}/health/shares/new`}
                  onClick={() => setModal(null)}
                >
                  Prepare PDF summary
                </Link>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Record this pet as rehomed? It will leave Home, remain in your Rehomed list, and its existing sharing links will be revoked. Records stay in your account.",
                      )
                    )
                      void action(async () => {
                        await api(`/api/pets/${pet.id}/state`, "PATCH", {
                          status: "REHOMED",
                          recipientEmail,
                          confirmed: true,
                        });
                        setModal(null);
                      }, "Transfer recorded. Shared links revoked.");
                  }}
                >
                  Transfer to new owner
                </button>
              </div>
            )}
            {pet.status !== "DECEASED" && (
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      `Mark ${pet.name} as deceased? Their profile and photos will be kept privately in your memories.`,
                    )
                  )
                    void action(async () => {
                      await api(`/api/pets/${pet.id}/state`, "PATCH", {
                        status: "DECEASED",
                      });
                      setModal(null);
                    }, "A place in your memories, always.");
                }}
              >
                <Heart size={18} /> Mark as deceased
              </button>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
function PetForm({
  pet,
  onSaved,
}: {
  pet?: Pet;
  onSaved: (p: Pet) => Promise<void>;
}) {
  const [name, setName] = useState(pet?.name || ""),
    [careType, setCareType] = useState(pet?.careType || "INHOUSE"),
    [species, setSpecies] = useState(pet?.species || "DOG"),
    [sex, setSex] = useState(pet?.sex || "UNKNOWN"),
    [precision, setPrecision] = useState(pet?.birthPrecision || "UNKNOWN"),
    [date, setDate] = useState(pet?.birthDate?.slice(0, 10) || ""),
    [file, setFile] = useState<File | null>(null),
    [filePreview, setFilePreview] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [savedId, setSavedId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setFilePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  async function save(e: React.FormEvent<HTMLFormElement>, skipPhoto = false) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      let p: Pet;
      const body = {
        name,
        species,
        sex,
        birthPrecision: precision,
        birthDate: date,
        ageEntry: precision === "UNKNOWN" ? "" : `${precision}: ${date}`,
        careType,
        normalLocation: String(form.get("normalLocation") || ""),
        breed: String(form.get("breed") || ""),
        mixedBreed: form.get("mixedBreed") === "on",
        colour: String(form.get("colour") || ""),
        markings: String(form.get("markings") || ""),
        microchip: String(form.get("microchip") || ""),
        neutered: String(form.get("neutered") || "UNKNOWN"),
        area: String(form.get("area") || ""),
        description: String(form.get("description") || ""),
      };
      if (savedId) p = await api(`/api/pets/${savedId}`, "PATCH", body);
      else
        p = await api(
          pet ? `/api/pets/${pet.id}` : "/api/pets",
          pet ? "PATCH" : "POST",
          body,
        );
      setSavedId(p.id);
      if (file && !skipPhoto) {
        const upload = new FormData();
        upload.set("file", file);
        await api(`/api/pets/${p.id}/photos`, "POST", upload);
      }
      await onSaved(p);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="form-page">
      <Link
        className="back-link"
        href={pet ? `/app/pets/${pet.id}` : "/app/pets"}
      >
        <ArrowLeft size={17} /> {pet ? "Back to profile" : "My pets"}
      </Link>
      <span className="eyebrow">
        {pet ? "IT’S ALL IN THE DETAILS" : "A NEW FACE IN THE FAMILY"}
      </span>
      <h1>
        {pet ? `A little more about ${pet.name}.` : "Who’s joining the family?"}
      </h1>
      <p className="muted">
        {pet
          ? "Keep their little details up to date."
          : "Just a name and species to start. Everything else can wait."}
      </p>
      <form onSubmit={save} className="pet-form">
        {!pet && (
          <div className="form-photo-row">
            <button
              type="button"
              className="form-photo"
              onClick={() => inputRef.current?.click()}
              aria-label="Choose a pet photo"
            >
              {filePreview ? (
                <img src={filePreview} alt="Chosen pet photo" />
              ) : (
                <Camera size={30} />
              )}
            </button>
            <div>
              <strong>A face to fall in love with</strong>
              <p>Optional · JPEG, PNG or WebP · up to 10 MB</p>
              <button
                type="button"
                className="text-link"
                onClick={() => inputRef.current?.click()}
              >
                {file ? "Change photo" : "Choose a photo"}
              </button>
              <label className="text-link camera-inline">
                Take a photo
                <input
                  className="sr-only"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </label>
              <input
                type="file"
                ref={inputRef}
                hidden
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>
          </div>
        )}
        <label>
          Pet’s name <span className="required">*</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={60}
            placeholder="Milo, Coco, or something wonderfully them"
          />
        </label>
        <fieldset className="species-field">
          <legend>
            Cat or dog? <span className="required">*</span>
          </legend>
          <div className="species-options">
            {(["DOG", "CAT"] as const).map((s) => (
              <label className={species === s ? "selected" : ""} key={s}>
                <input
                  type="radio"
                  name="species"
                  value={s}
                  checked={species === s}
                  onChange={() => setSpecies(s)}
                />
                <PawPrint size={25} />
                {s === "DOG" ? "Dog" : "Cat"}
                {species === s && <Check size={18} />}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="form-grid">
          <label>
            Sex <small>Optional</small>
            <select value={sex} onChange={(e) => setSex(e.target.value)}>
              <option value="UNKNOWN">Unknown for now</option>
              <option value="FEMALE">Female</option>
              <option value="MALE">Male</option>
            </select>
          </label>
          <label>
            Birthday <small>Optional</small>
            <select
              value={precision}
              onChange={(e) => {
                setPrecision(e.target.value);
                setDate("");
              }}
            >
              <option value="UNKNOWN">I’m not sure yet</option>
              <option value="EXACT">I know the exact date</option>
              <option value="APPROXIMATE">I have an approximate date</option>
              <option value="YEAR">I know the birth year</option>
            </select>
          </label>
        </div>
        {precision !== "UNKNOWN" && (
          <label>
            {precision === "YEAR"
              ? "Approximate birth year"
              : precision === "EXACT"
                ? "Date of birth"
                : "Approximate date of birth"}
            {precision === "YEAR" ? (
              <input
                type="number"
                min={1900}
                max={new Date().getFullYear()}
                required
                value={date.slice(0, 4)}
                onChange={(e) =>
                  setDate(e.target.value ? `${e.target.value}-01-01` : "")
                }
              />
            ) : (
              <input
                type="date"
                min="1900-01-01"
                max={new Date().toISOString().slice(0, 10)}
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            )}
            <small>
              {precision === "EXACT"
                ? "Their exact birthday stays private."
                : "We’ll display their age as approximate, never as an exact birthday."}
            </small>
          </label>
        )}
        <details className="optional-details" open={!!pet}>
          <summary>
            The little details <span>Care and optional details</span>
          </summary>
          <label>
            Care arrangement
            <select
              name="careType"
              value={careType}
              onChange={(e) =>
                setCareType(e.target.value as "INHOUSE" | "CARE_STRAY")
              }
            >
              <option value="INHOUSE">Inhouse</option>
              <option value="CARE_STRAY">Care stray</option>
            </select>
          </label>
          {careType === "CARE_STRAY" && (
            <label>
              Normal location <small>Private · required</small>
              <input
                name="normalLocation"
                required
                maxLength={200}
                defaultValue={pet?.normalLocation || ""}
                placeholder="Where you usually find or care for this stray"
              />
            </label>
          )}
          <div className="form-grid">
            <label>
              Breed
              <input
                name="breed"
                defaultValue={pet?.breed || ""}
                maxLength={100}
                placeholder="e.g. Golden retriever"
              />
            </label>
            <label>
              Colour
              <input
                name="colour"
                defaultValue={pet?.colour || ""}
                maxLength={80}
                placeholder="e.g. Golden"
              />
            </label>
          </div>
          <label className="checkbox-label">
            <input
              type="checkbox"
              name="mixedBreed"
              defaultChecked={pet?.mixedBreed}
            />
            Mixed breed
          </label>
          <div className="form-grid">
            <label>
              Neutered / spayed
              <select name="neutered" defaultValue={pet?.neutered || "UNKNOWN"}>
                <option value="UNKNOWN">Unknown</option>
                <option value="YES">Yes</option>
                <option value="NO">No</option>
              </select>
            </label>
            <label>
              Microchip <small>Always private</small>
              <input
                name="microchip"
                defaultValue={pet?.microchip || ""}
                maxLength={40}
              />
            </label>
          </div>
          <label>
            Distinguishing markings
            <input
              name="markings"
              defaultValue={pet?.markings || ""}
              maxLength={500}
            />
          </label>
          <label>
            General area
            <input
              name="area"
              defaultValue={pet?.area || ""}
              maxLength={100}
              placeholder="Town or neighbourhood, not your address"
            />
          </label>
          <label>
            A little introduction
            <textarea
              name="description"
              defaultValue={pet?.description || ""}
              maxLength={600}
              rows={4}
              placeholder="Loves long walks, sunny spots, and stealing everyone's slippers."
            />
            <small>
              Can appear on their public profile if you choose to publish it.
            </small>
          </label>
        </details>
        <p className="form-privacy">
          <LockKeyhole size={17} />{" "}
          {pet
            ? "Private details stay private."
            : "Their new profile will be private. Always."}
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
            {savedId
              ? " Your pet is saved. Retry, or remove the selected photo to continue."
              : ""}
          </p>
        )}
        {savedId && error && file && (
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setFile(null);
              setFilePreview("");
              setError("");
            }}
          >
            Remove photo and continue
          </button>
        )}
        <div className="form-actions">
          <Link
            className="button secondary"
            href={pet ? `/app/pets/${pet.id}` : "/app/pets"}
          >
            Cancel
          </Link>
          <button className="button primary" disabled={busy}>
            {busy ? (
              <>
                <LoaderCircle size={18} className="spin" /> Saving…
              </>
            ) : (
              <>
                {pet || savedId ? "Save profile" : "Add my pet"}
                <ArrowUpRight size={18} />
              </>
            )}
          </button>
        </div>
      </form>
    </section>
  );
}
function PhotoManager({
  pet,
  onUpdate,
}: {
  pet: Pet;
  onUpdate: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [view, setView] = useState("UNSPECIFIED"),
    [replace, setReplace] = useState("");
  const picker = useRef<HTMLInputElement>(null);
  async function upload(file?: File, replacement = replace) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const f = new FormData();
      f.set("file", file);
      f.set("view", view);
      if (replacement) f.set("replaceId", replacement);
      await api(`/api/pets/${pet.id}/photos`, "POST", f);
      await onUpdate();
      setReplace("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (picker.current) picker.current.value = "";
    }
  }
  async function change(id: string, remove = false) {
    setBusy(true);
    setError("");
    try {
      await api(
        `/api/pets/${pet.id}/photos/${id}`,
        remove ? "DELETE" : "PATCH",
      );
      await onUpdate();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <p className="modal-description">
        Three little views of your favourite face. Only the main photo can
        appear on a public profile.
      </p>
      <div className="photo-manager-grid">
        {pet.images.map((i) => (
          <div className="photo-tile" key={i.id}>
            <img
              src={`/api/images/${i.id}?size=thumb`}
              alt={`${pet.name}, ${i.view.toLowerCase()} view`}
            />
            <span className="photo-view">
              {i.view === "UNSPECIFIED" ? "Pet photo" : i.view.toLowerCase()}{" "}
              {pet.mainImageId === i.id ? "· Main" : ""}
            </span>
            <div className="photo-actions">
              <button
                disabled={busy || pet.mainImageId === i.id}
                onClick={() => change(i.id)}
              >
                Make main
              </button>
              <button
                disabled={busy}
                onClick={() => {
                  setReplace(i.id);
                  picker.current?.click();
                }}
              >
                Replace
              </button>
              <button
                disabled={busy}
                onClick={() => {
                  if (confirm("Remove this photo?")) void change(i.id, true);
                }}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
      {pet.images.length < 3 && (
        <>
          <label>
            Photo view
            <select value={view} onChange={(e) => setView(e.target.value)}>
              <option value="UNSPECIFIED">Any view</option>
              <option value="FRONT">Front</option>
              <option value="LEFT">Left side</option>
              <option value="RIGHT">Right side</option>
            </select>
          </label>
          <div className="button-row">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => {
                setReplace("");
                picker.current?.click();
              }}
            >
              <ImagePlus size={18} /> Choose from library
            </button>
            <label className={`button secondary ${busy ? "disabled" : ""}`}>
              <Camera size={18} /> Take photo
              <input
                type="file"
                className="sr-only"
                disabled={busy}
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                onChange={(e) => {
                  setReplace("");
                  void upload(e.target.files?.[0], "");
                }}
              />
            </label>
          </div>
        </>
      )}
      <input
        ref={picker}
        type="file"
        hidden
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => upload(e.target.files?.[0])}
      />
      {busy && <p role="status">Saving your photo…</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <p className="fine-print">
        JPEG, PNG or WebP · up to 10 MB each. Location metadata is removed.
      </p>
    </>
  );
}
function Profile({
  user,
  demo,
  deletion,
  onUpdate,
}: {
  user: User;
  demo: boolean;
  deletion: { requestedAt: string } | null;
  onUpdate: () => Promise<void>;
}) {
  const router = useRouter();
  const [name, setName] = useState(user.name),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [showDelete, setShowDelete] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/account", "PATCH", { name });
      await onUpdate();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function deletionAction() {
    setBusy(true);
    setError("");
    try {
      await api("/api/account", "POST", { password, cancel: !!deletion });
      await onUpdate();
      setShowDelete(false);
      setPassword("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="profile-page">
      <span className="eyebrow">THE PERSON BEHIND THE PAWS</span>
      <h1>
        Your profile<span className="heading-dot">.</span>
      </h1>
      <div className="profile-header">
        <span className="avatar large">{user.name[0]}</span>
        <div>
          <h2>{user.name}</h2>
          <p>{user.email}</p>
          <span className="verified">
            <Check size={14} /> Email verified
          </span>
        </div>
      </div>
      <form className="detail-panel" onSubmit={save}>
        <h2>A little about you</h2>
        <label>
          Your name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={80}
          />
        </label>
        <button className="button primary" disabled={busy}>
          Save changes
        </button>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="detail-panel stack">
        <h2>Your account</h2>
        <Link className="settings-row" href="/login?mode=forgot">
          <Mail size={19} />
          <span>Reset your password</span>
          <ChevronRight size={17} />
        </Link>
        {demo && (
          <Link className="settings-row" href="/local-mail">
            <Mail size={19} />
            <span>Local test mailbox</span>
            <ChevronRight size={17} />
          </Link>
        )}
        <button
          className="settings-row"
          onClick={async () => {
            await authClient.signOut();
            router.replace("/login");
            router.refresh();
          }}
        >
          <LogOut size={19} />
          <span>Sign out</span>
          <ChevronRight size={17} />
        </button>
      </div>
      <div className="account-deletion">
        <h2>
          {deletion
            ? "Deletion request received"
            : "Need to close your account?"}
        </h2>
        <p>
          {deletion
            ? "Your request is recorded. It requires review, and you can cancel it. No records have been deleted."
            : "Request account deletion for review. Pets now cared for by another owner will not be deleted."}
        </p>
        <button className="text-button" onClick={() => setShowDelete(true)}>
          {deletion ? "Cancel deletion request" : "Request account deletion"}
        </button>
        <p className="fine-print">
          A 30-day recovery window is proposed after processing begins. This
          local demo records requests; it does not run permanent deletion.
        </p>
      </div>
      {showDelete && (
        <Modal
          title={
            deletion ? "Cancel deletion request" : "Request account deletion"
          }
          onClose={() => setShowDelete(false)}
        >
          <p>
            Please confirm your password. This records a request for review; it
            does not immediately remove your account or pet records.
          </p>
          <label>
            Current password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button
            className="button primary full"
            disabled={busy || !password}
            onClick={deletionAction}
          >
            {deletion ? "Cancel request" : "Submit request"}
          </button>
        </Modal>
      )}
    </section>
  );
}
