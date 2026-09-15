"use client";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  Camera,
  Check,
  Download,
  Smartphone,
  Wifi,
} from "lucide-react";
import { InstallButton, usePwa } from "./pwa-provider";
export default function InstallGuide() {
  const { secure } = usePwa();
  return (
    <main className="install-page">
      <Link className="back-link" href="/app">
        <ArrowLeft size={17} />
        Open Petish
      </Link>
      <header className="install-hero">
        <img
          src="/icons/petish-192.png"
          alt="Petish app icon"
          width={88}
          height={88}
        />
        <span className="eyebrow">A LITTLE CLOSER, EVERY DAY</span>
        <h1>
          Their little world.
          <br />
          On your home screen.
        </h1>
        <p>
          Add Petish to your phone for a familiar place to keep their photos,
          visits, and everyday details.
        </p>
        <InstallButton />
        {!secure && (
          <p className="error">
            Open the secure HTTPS address to install Petish. An ordinary
            local-network address cannot provide the full app experience.
          </p>
        )}
      </header>
      <div className="install-guides">
        <section>
          <Smartphone size={25} />
          <h2>iPhone or iPad</h2>
          <ol>
            <li>
              Open this website in <strong>Safari</strong>.
            </li>
            <li>
              Open the <strong>Share</strong> menu. Depending on your layout, it
              may be inside the More menu.
            </li>
            <li>
              Choose <strong>Add to Home Screen</strong>. If it is missing, use
              Edit Actions to add it.
            </li>
            <li>
              If shown, enable <strong>Open as Web App</strong>, then tap{" "}
              <strong>Add</strong>.
            </li>
          </ol>
          <p className="fine-print">
            Open the new Petish icon. You may need to sign in again.
          </p>
        </section>
        <section>
          <Download size={25} />
          <h2>Android</h2>
          <ol>
            <li>
              Open this website in <strong>Chrome</strong>.
            </li>
            <li>
              Use <strong>Install Petish</strong> above when available, or open
              Chrome’s <strong>⋮ menu</strong>.
            </li>
            <li>
              Choose <strong>Install app</strong> or{" "}
              <strong>Add to Home screen</strong>, then confirm.
            </li>
            <li>Open Petish from its new home-screen icon.</li>
          </ol>
          <p className="fine-print">
            Menu wording varies. If you opened a link inside another app, open
            it in Chrome first.
          </p>
        </section>
      </div>
      <section className="install-camera">
        <Camera size={25} />
        <div>
          <h2>Try your first camera upload</h2>
          <p>
            Open a pet → Health record → Add health record → Medication → Take
            photo. Accept any camera prompt, take a picture, and save the entry.
          </p>
          <p className="fine-print">
            You can also choose an existing image. Camera and file-picker
            behaviour depends on your phone and browser. JPEG, PNG and WebP are
            supported; convert HEIC before uploading if your phone supplies that
            format.
          </p>
          <Link className="button secondary" href="/app">
            Open my pets
            <ArrowUpRight size={17} />
          </Link>
        </div>
      </section>
      <section className="install-online">
        <Wifi size={22} />
        <div>
          <h2>A connection keeps everything together</h2>
          <p>
            Petish needs an internet connection to load and save records. Your
            private pet details, photos and health records are not saved in an
            offline app cache. Finish saving before closing the screen.
          </p>
        </div>
      </section>
      <p className="install-footnote">
        <Check size={17} />
        The app updates from the website. When an update is ready, Petish asks
        you to save your work before reloading.
      </p>
    </main>
  );
}
