"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="standalone">
      <h1>Let’s try that again.</h1>
      <p>We couldn’t load this page. Your saved information is still there.</p>
      <button className="button primary" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
