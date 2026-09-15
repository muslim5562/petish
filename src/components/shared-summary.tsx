"use client";
import { useEffect, useState } from "react";
import { LockKeyhole, RefreshCw, ShieldCheck } from "lucide-react";
import SummarySnapshot from "./summary-snapshot";
import type { SummaryContent } from "@/lib/share-rules";
type Payload = {
  content: SummaryContent;
  createdAt: string;
  expiresAt: string | null;
  serverNow: string;
};
export default function SharedSummary() {
  const [value, setValue] = useState<Payload | null>(null),
    [message, setMessage] = useState("Checking this protected link…"),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true,
      busy = false,
      generation = 0;
    let expiryTimer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    async function check() {
      if (busy || document.visibilityState === "hidden") return;
      const token = location.hash.slice(1);
      if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
        setValue(null);
        setMessage(
          "This shared summary is not available. Open the complete link, including the part after #.",
        );
        return;
      }
      busy = true;
      const current = ++generation;
      controller = new AbortController();
      try {
        const response = await fetch("/api/shared-summary", {
          method: "POST",
          credentials: "omit",
          cache: "no-store",
          referrerPolicy: "no-referrer",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
          signal: controller.signal,
        });
        if (!response.ok)
          throw new Error(
            "This link is unavailable. It may have expired or been revoked. Ask the owner for a new link.",
          );
        const result: Payload = await response.json();
        if (!active || current !== generation) return;
        setValue(result);
        setMessage("");
        if (expiryTimer) clearTimeout(expiryTimer);
        if (result.expiresAt) {
          const remaining =
            new Date(result.expiresAt).getTime() -
            new Date(result.serverNow).getTime();
          expiryTimer = setTimeout(
            () => {
              setValue(null);
              setMessage(
                "This link has expired. Ask the owner for a new link.",
              );
            },
            Math.min(Math.max(remaining, 0), 2147483647),
          );
        }
      } catch (e) {
        if (active && current === generation) {
          setValue(null);
          setMessage(
            e instanceof TypeError
              ? "A connection is required to check this link. Reconnect and try again."
              : (e as Error).message,
          );
        }
      } finally {
        busy = false;
      }
    }
    const hide = () => {
      if (document.visibilityState === "hidden") {
        generation++;
        if (expiryTimer) clearTimeout(expiryTimer);
        controller?.abort();
        busy = false;
        setValue(null);
        setMessage("Checking this protected link…");
      } else void check();
    };
    const changed = () => {
      generation++;
      if (expiryTimer) clearTimeout(expiryTimer);
      controller?.abort();
      busy = false;
      setValue(null);
      setMessage("Checking this protected link…");
      void check();
    };
    const offline = () => {
      generation++;
      if (expiryTimer) clearTimeout(expiryTimer);
      controller?.abort();
      busy = false;
      setValue(null);
      setMessage(
        "A connection is required to check this link. Reconnect and try again.",
      );
    };
    void check();
    const poll = setInterval(() => void check(), 30000);
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("hashchange", changed);
    window.addEventListener("offline", offline);
    window.addEventListener("online", changed);
    return () => {
      active = false;
      controller?.abort();
      clearInterval(poll);
      if (expiryTimer) clearTimeout(expiryTimer);
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("hashchange", changed);
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", changed);
    };
  }, [retry]);
  return (
    <main className="shared-page">
      <header className="shared-heading">
        <span className="brand">petish</span>
        <span>
          <LockKeyhole size={15} />
          Protected link
        </span>
      </header>
      <h1>Shared health summary.</h1>
      {value ? (
        <>
          <div className="shared-access">
            <ShieldCheck size={19} />
            <div>
              <strong>Read-only snapshot</strong>
              <p>
                Link created {new Date(value.createdAt).toLocaleString()} ·{" "}
                {value.expiresAt
                  ? `Expires ${new Date(value.expiresAt).toLocaleString()}`
                  : "Available until the owner revokes it"}
              </p>
            </div>
          </div>
          <SummarySnapshot content={value.content} />
          <p className="fine-print">
            The owner can stop future access to this link. Screenshots and saved
            copies cannot be recalled. This link does not provide access to the
            pet’s live record or documents.
          </p>
        </>
      ) : (
        <section className="share-unavailable">
          <LockKeyhole size={30} />
          <p role="status">{message}</p>
          <button
            className="button secondary"
            onClick={() => setRetry((r) => r + 1)}
          >
            <RefreshCw size={17} />
            Check link again
          </button>
        </section>
      )}
      <noscript>
        This protected summary requires JavaScript and a connection so its
        expiry and access can be checked.
      </noscript>
    </main>
  );
}
