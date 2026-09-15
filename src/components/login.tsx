"use client";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  PawPrint,
  ArrowRight,
  ArrowLeft,
  Mail,
  CheckCircle2,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
export default function Login({ demo: showDemo }: { demo: boolean }) {
  const router = useRouter();
  const query = useSearchParams();
  const token = query.get("token");
  const initial = token ? "reset" : query.get("mode") || "login";
  const [mode, setMode] = useState(initial),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      let result;
      if (mode === "signup")
        result = await authClient.signUp.email({
          name,
          email,
          password,
          callbackURL: "/app",
        });
      else if (mode === "forgot")
        result = await authClient.requestPasswordReset({
          email,
          redirectTo: "/login",
        });
      else if (mode === "reset")
        result = await authClient.resetPassword({
          token: token!,
          newPassword: password,
        });
      else
        result = await authClient.signIn.email({
          email,
          password,
          callbackURL: "/app",
        });
      if (result.error)
        throw new Error(result.error.message || "Please try again.");
      if (mode === "login") {
        router.push("/app");
        router.refresh();
        return;
      }
      setMessage(
        mode === "signup"
          ? "Check your email to verify your account."
          : mode === "forgot"
            ? "If that account exists, a recovery link is on its way."
            : "Your password has been changed. You can sign in now.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function demo() {
    setBusy(true);
    const res = await fetch("/api/demo", { method: "POST" });
    if (res.ok) {
      router.push("/app");
      router.refresh();
    } else {
      setError("Demo sign-in is only available in the configured local demo.");
      setBusy(false);
    }
  }
  function switchMode(next: string) {
    setMode(next);
    setError("");
    setMessage("");
  }
  return (
    <main className="auth-layout">
      <div className="auth-visual">
        <Link className="brand" href="/">
          <PawPrint />
          petish<span>®</span>
        </Link>
        <div>
          <span className="eyebrow">SMALL PAWS. BIG PERSONALITIES.</span>
          <h1>
            A place for
            <br />
            your favourite
            <br />
            <em>little faces.</em>
          </h1>
        </div>
        <img src="/demo/tabby-kitten.jpg" alt="Curious tabby kitten" />
        <span className="auth-photo-credit">
          <Link href="/credits">Photo credits</Link>
        </span>
      </div>
      <div className="auth-form">
        <Link href="/" className="back-link">
          <ArrowLeft size={18} /> Back to Petish
        </Link>
        <div className="auth-form-inner">
          <span className="eyebrow">WELCOME TO THE FAMILY</span>
          <h1>
            {mode === "signup"
              ? "Make yourself at home."
              : mode === "forgot"
                ? "Let’s get you back in."
                : mode === "reset"
                  ? "A fresh start."
                  : "Good to see you."}
          </h1>
          <p className="muted">
            {mode === "signup"
              ? "Your pet’s next chapter starts with you."
              : mode === "forgot"
                ? "Enter your email and we’ll help you reset your password."
                : mode === "reset"
                  ? "Choose a new password with at least 10 characters."
                  : "Sign in to spend a little time with your pets."}
          </p>
          <form onSubmit={submit}>
            {mode === "signup" && (
              <label>
                Your name
                <input
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={80}
                />
              </label>
            )}
            {mode !== "reset" && (
              <label>
                Email address
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>
            )}
            {mode !== "forgot" && (
              <label>
                Password
                <input
                  aria-label="Password"
                  type="password"
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={10}
                />
                {mode === "signup" && <small>At least 10 characters.</small>}
              </label>
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            {message && (
              <p className="success" role="status">
                <CheckCircle2 size={18} />
                {message}
              </p>
            )}
            <button className="button primary full" disabled={busy}>
              {busy
                ? "One moment…"
                : mode === "signup"
                  ? "Create account"
                  : mode === "forgot"
                    ? "Send recovery link"
                    : mode === "reset"
                      ? "Set new password"
                      : "Sign in"}
              <ArrowRight size={18} />
            </button>
          </form>
          {mode === "login" ? (
            <>
              <button
                className="text-button"
                onClick={() => switchMode("forgot")}
              >
                Forgot your password?
              </button>
              <p className="auth-switch">
                New here?{" "}
                <button onClick={() => switchMode("signup")}>
                  Create an account
                </button>
              </p>
            </>
          ) : (
            <button className="text-button" onClick={() => switchMode("login")}>
              Back to sign in
            </button>
          )}
          <Link className="pwa-install-link" href="/install">
            Install Petish on your phone
          </Link>
          {showDemo && (
            <div className="demo-login">
              <span className="badge">LOCAL DEMO</span>
              <p>Take a look around with Milo and friends.</p>
              <button
                className="button secondary full"
                onClick={demo}
                disabled={busy}
              >
                Explore the demo <PawPrint size={18} />
              </button>
              <Link className="mail-link" href="/local-mail">
                <Mail size={16} /> Open local test mailbox
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
