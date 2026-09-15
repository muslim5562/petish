"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
type Mail = { to: string; subject: string; url: string; createdAt: string };
export default function LocalMail() {
  const [messages, setMessages] = useState<Mail[]>([]);
  const [error, setError] = useState("");
  async function refresh() {
    const r = await fetch("/api/local-mail");
    if (r.ok) setMessages(await r.json());
    else setError("The local mailbox is not available.");
  }
  useEffect(() => {
    void refresh();
  }, []);
  return (
    <main className="standalone">
      <Link href="/login" className="back-link">
        ← Back to sign in
      </Link>
      <span className="eyebrow">LOCAL DEVELOPMENT ONLY</span>
      <h1>Test mailbox</h1>
      <p>
        These messages are captured on this computer. No email has been sent.
        Use synthetic addresses only; anyone using this local demo can see this
        mailbox.
      </p>
      <button className="button secondary" onClick={refresh}>
        Refresh mailbox
      </button>
      {error && <p role="alert">{error}</p>}
      {messages.length === 0 ? (
        <p className="empty-note">
          No messages yet. Create an account to receive a verification link
          here.
        </p>
      ) : (
        messages.map((m, i) => (
          <article className="mail-item" key={i}>
            <span className="eyebrow">TO {m.to}</span>
            <h2>{m.subject}</h2>
            <p>{new Date(m.createdAt).toLocaleString()}</p>
            <a className="button primary" href={m.url}>
              Open secure link
            </a>
          </article>
        ))
      )}
    </main>
  );
}
