"use client";
import { useEffect, useState } from "react";
import type { SummaryContent } from "@/lib/share-rules";

export default function SummaryPdfActions({
  content,
}: {
  content: SummaryContent;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState("");
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setDownloadUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  async function prepare() {
    setBusy(true);
    setMessage("");
    try {
      const { summaryPdf } = await import("@/lib/summary-pdf");
      const fonts = await Promise.all(
        ["regular", "bold"].map(async (name) => {
          const r = await fetch(`/fonts/summary-${name}.woff`);
          if (!r.ok)
            throw new Error(
              "Could not load the PDF font. Reconnect and try again.",
            );
          return new Uint8Array(await r.arrayBuffer());
        }),
      );
      const bytes = await summaryPdf(content, fonts[0], fonts[1]);
      setFile(
        new File([new Uint8Array(bytes)], "petish-health-summary.pdf", {
          type: "application/pdf",
        }),
      );
      setMessage(
        "PDF ready. Download it or share it with an app on your device.",
      );
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "Could not prepare the PDF. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function share() {
    if (!file) return;
    if (!navigator.canShare?.({ files: [file] }) || !navigator.share) {
      setMessage(
        "File sharing is unavailable in this browser. Download the PDF, then attach it as a document in WhatsApp or another app.",
      );
      return;
    }
    try {
      await navigator.share({ files: [file] });
      setMessage("PDF handed to your device's sharing menu.");
    } catch (e) {
      setMessage(
        (e as Error).name === "AbortError"
          ? "Sharing cancelled. Your PDF is still ready."
          : "Sharing could not finish. Download the PDF and attach it in your chosen app.",
      );
    }
  }
  return (
    <section className="share-confirm" aria-label="PDF sharing">
      <h2>Share a PDF copy</h2>
      <p>
        Send the selected summary through WhatsApp or another app that accepts
        PDF documents. A PDF is a permanent copy: it does not expire and cannot
        be revoked.
      </p>
      {!file ? (
        <>
          <label className="share-check">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            I reviewed the selected details and understand that saved PDFs can
            be copied and forwarded.
          </label>
          <button
            className="button secondary"
            disabled={!confirmed || busy}
            onClick={() => void prepare()}
          >
            {busy ? "Preparing PDF…" : "Prepare PDF"}
          </button>
        </>
      ) : (
        <div className="button-row">
          {downloadUrl && (
            <a
              className="button secondary"
              href={downloadUrl}
              download="petish-health-summary.pdf"
            >
              Download PDF
            </a>
          )}
          <button className="button primary" onClick={() => void share()}>
            Share PDF…
          </button>
        </div>
      )}
      <p className="fine-print">
        On a supported phone, choose WhatsApp from the sharing menu. Available
        apps depend on your device. Otherwise download and attach the PDF
        manually.
      </p>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
