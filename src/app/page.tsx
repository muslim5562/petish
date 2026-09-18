import Link from "next/link";
import {
  PawPrint,
  ArrowUpRight,
  Heart,
  LockKeyhole,
  Camera,
} from "lucide-react";
export default function Landing() {
  return (
    <main className="landing">
      <header className="landing-nav">
        <Link className="brand" href="/">
          <PawPrint />
          petish<span>®</span>
        </Link>
        <Link className="text-link" href="/lost-found">
          Lost &amp; Found
        </Link>
        <Link className="button secondary" href="/login">
          Sign in <ArrowUpRight size={18} />
        </Link>
      </header>
      <section className="landing-hero">
        <div>
          <span className="eyebrow">FOR THE ONES WITH PAWS</span>
          <h1>
            Their little world.
            <br />
            <em>All together.</em>
          </h1>
          <p>
            A home for your pet’s photos, personality, and everyday details.
            Made for the people who love them.
          </p>
          <div className="button-row">
            <Link className="button primary" href="/login?mode=signup">
              Meet your new pet space <ArrowUpRight size={18} />
            </Link>
          </div>
          <div className="landing-note">
            <LockKeyhole size={16} />
            Private until you choose to share.
          </div>
        </div>
        <div className="landing-photo">
          <img
            src="/demo/golden-retriever.jpg"
            alt="Golden retriever puppy enjoying the grass"
          />
          <span className="photo-sticker">
            <Heart size={20} /> A whole lot of love.
          </span>
        </div>
      </section>
      <section className="landing-benefits">
        <article>
          <PawPrint />
          <h2>Every pet, their own space</h2>
          <p>
            A familiar face. A favourite photo. The details that make them,
            them.
          </p>
        </article>
        <article>
          <Camera />
          <h2>Less typing, more tail wags</h2>
          <p>Start with a name. Add the rest whenever you have a moment.</p>
        </article>
        <article>
          <LockKeyhole />
          <h2>Sharing on your terms</h2>
          <p>
            Keep their profile private or preview exactly what others will see.
          </p>
        </article>
      </section>
      <footer className="landing-footer">
        <Link href="/install">Install on your phone</Link>
        <span>Made for your kind of family.</span>
        <Link href="/credits">Photo credits</Link>
      </footer>
    </main>
  );
}
