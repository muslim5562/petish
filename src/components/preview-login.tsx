"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
export default function PreviewLogin() {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <main className="install-page">
      <header className="install-hero">
        <img src="/icons/petish-192.png" width={88} height={88} alt="Petish" />
        <span className="eyebrow">PHONE TESTING PREVIEW</span>
        <h1>
          A little home.
          <br />
          Ready to try.
        </h1>
        <p>
          This is a shared demo with fictional pets. Use sample photos and notes
          only; anyone using this preview can explore the same demo account.
        </p>
        <button
          className="button primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              const response = await fetch("/api/demo", { method: "POST" });
              if (!response.ok)
                throw new Error("Could not open the demo. Please try again.");
              router.push("/app");
              router.refresh();
            } catch (e) {
              setError((e as Error).message);
              setBusy(false);
            }
          }}
        >
          {busy ? "Opening…" : "Explore the demo"}
        </button>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <p>
          <Link className="pwa-install-link" href="/install">
            Install Petish on your phone
          </Link>
        </p>
        <p className="fine-print">
          No registration is needed. This temporary preview works while the host
          computer and preview process remain running.
        </p>
      </header>
    </main>
  );
}
