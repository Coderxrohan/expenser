"use client";

// Log in / sign up / forgot-password / set-new-password.
// Port of client/js/auth.js.

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { sb } from "@/lib/supabase";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();

  const [tab, setTab] = useState(params.get("tab") === "signup" ? "signup" : "login");
  const [form, setForm] = useState("login"); // login | signup | reset | newpass
  const [fields, setFields] = useState({ email: "", password: "", resetEmail: "", newPassword: "" });
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setFields((f) => ({ ...f, [k]: e.target.value }));

  // already signed in → straight to the dashboard, except when arriving
  // from a password-reset link (recovery session must land on new-password)
  useEffect(() => {
    const isResetFlow = params.get("reset") === "1";
    sb.auth.getSession().then(async ({ data }) => {
      if (!data.session || isResetFlow) return;
      const { error } = await sb.auth.getUser();
      if (error) {
        await sb.auth.signOut(); // clear the dead session; stay on login
        return;
      }
      router.replace("/dashboard");
    });

    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) {
        window.history.replaceState(null, "", "/login?reset=1");
        setForm("newpass");
      }
    });
    if (isResetFlow) {
      // recovery session may already be established by detectSessionInUrl
      sb.auth.getSession().then(({ data }) => {
        if (data.session) setForm("newpass");
      });
    }
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    const { error } = await sb.auth.signInWithPassword({
      email: fields.email.trim(),
      password: fields.password,
    });
    setBusy(false);
    if (error) setError(error.message);
    else router.push("/dashboard");
  };

  const signup = async (e) => {
    e.preventDefault();
    setError("");
    setNote("");
    setBusy(true);
    const { error } = await sb.auth.signUp({
      email: fields.email.trim(),
      password: fields.password,
    });
    setBusy(false);
    if (error) setError(error.message);
    else setNote("Account created. Check your inbox to confirm, then log in.");
  };

  const sendReset = async (e) => {
    e.preventDefault();
    setError("");
    setNote("");
    setBusy(true);
    const { error } = await sb.auth.resetPasswordForEmail(fields.resetEmail.trim(), {
      redirectTo: window.location.origin + "/login?reset=1",
    });
    setBusy(false);
    if (error) setError(error.message);
    else setNote("Reset link sent. Check your inbox (and spam) — it opens a page to set a new password.");
  };

  const setNewPassword = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    const { error } = await sb.auth.updateUser({ password: fields.newPassword });
    setBusy(false);
    if (error) setError(error.message);
    else router.push("/dashboard");
  };

  return (
    <section className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand">
          <img className="brand-logo" src="/logo.svg" alt="Ledger logo" />
          <span className="brand-name">Ledger</span>
        </div>
        <p className="auth-tagline">A quiet place to keep the books.</p>

        <div className="auth-tabs">
          <button className={`auth-tab${tab === "login" ? " active" : ""}`} onClick={() => { setTab("login"); setForm("login"); setError(""); }}>Log in</button>
          <button className={`auth-tab${tab === "signup" ? " active" : ""}`} onClick={() => { setTab("signup"); setForm("signup"); setError(""); }}>Sign up</button>
        </div>

        {form === "login" && (
          <form className="auth-form" onSubmit={login}>
            <label>Email
              <input type="email" required autoComplete="email" value={fields.email} onChange={set("email")} />
            </label>
            <label>Password
              <input type="password" required autoComplete="current-password" value={fields.password} onChange={set("password")} />
            </label>
            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>{busy ? "Logging in…" : "Log in"}</button>
            {error && <p className="auth-error">{error}</p>}
            <button type="button" className="auth-link" onClick={() => { setForm("reset"); setError(""); setNote(""); }}>Forgot password?</button>
          </form>
        )}

        {form === "reset" && (
          <form className="auth-form" onSubmit={sendReset}>
            <p className="auth-note">Enter your account email and we&apos;ll send a reset link.</p>
            <label>Email
              <input type="email" required autoComplete="email" value={fields.resetEmail} onChange={set("resetEmail")} />
            </label>
            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</button>
            <button type="button" className="auth-link" onClick={() => { setForm("login"); setError(""); setNote(""); }}>Back to log in</button>
            {error && <p className="auth-error">{error}</p>}
            {note && <p className="auth-note">{note}</p>}
          </form>
        )}

        {form === "newpass" && (
          <form className="auth-form" onSubmit={setNewPassword}>
            <p className="auth-note">Choose a new password for your account.</p>
            <label>New password
              <input type="password" required minLength={6} autoComplete="new-password" value={fields.newPassword} onChange={set("newPassword")} />
            </label>
            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>{busy ? "Saving…" : "Set new password"}</button>
            {error && <p className="auth-error">{error}</p>}
          </form>
        )}

        {form === "signup" && (
          <form className="auth-form" onSubmit={signup}>
            <label>Email
              <input type="email" required autoComplete="email" value={fields.email} onChange={set("email")} />
            </label>
            <label>Password
              <input type="password" required minLength={6} autoComplete="new-password" value={fields.password} onChange={set("password")} />
            </label>
            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>{busy ? "Creating…" : "Create account"}</button>
            {error && <p className="auth-error">{error}</p>}
            {note && <p className="auth-note">{note}</p>}
          </form>
        )}
      </div>
    </section>
  );
}
