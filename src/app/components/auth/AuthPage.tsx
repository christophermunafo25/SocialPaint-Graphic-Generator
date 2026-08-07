import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/stores/supabase/client";

type View = "signin" | "signup" | "forgot" | "checkEmail" | "setPassword";

/** Sign in / sign up / password reset. Rendered whenever the Supabase
 * backend is active and there is no session. Also handles the recovery
 * redirect (Supabase fires PASSWORD_RECOVERY after the email link). */
export function AuthPage() {
  const [view, setView] = useState<View>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const { data: sub } = supabase().auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setView("setPassword");
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const signIn = () =>
    run(async () => {
      const { error: err } = await supabase().auth.signInWithPassword({ email, password });
      if (err) throw err;
      // Session change re-renders the app; nothing else to do.
    });

  const signUp = () =>
    run(async () => {
      const { data, error: err } = await supabase().auth.signUp({ email, password });
      if (err) throw err;
      if (!data.session) setView("checkEmail"); // email confirmation required
    });

  const forgot = () =>
    run(async () => {
      const { error: err } = await supabase().auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (err) throw err;
      setNotice("Password reset link sent — check your email.");
    });

  const setNewPassword = () =>
    run(async () => {
      const { error: err } = await supabase().auth.updateUser({ password });
      if (err) throw err;
      setNotice("Password updated.");
      setView("signin");
    });

  const field = (
    label: string,
    type: string,
    value: string,
    onChange: (v: string) => void,
    autoComplete?: string,
  ) => (
    <div>
      <label className="sp-eyebrow block mb-1">{label}</label>
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            if (view === "signin") void signIn();
            else if (view === "signup") void signUp();
            else if (view === "forgot") void forgot();
            else if (view === "setPassword") void setNewPassword();
          }
        }}
        className="sp-input"
      />
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--bg-canvas)" }}>
      <div
        className="w-full max-w-sm overflow-hidden"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-card)" }}
      >
        <div className="sp-mesh px-7 pt-7 pb-6">
          <p className="sp-eyebrow mb-1" style={{ color: "var(--brand-surface-fg)" }}>
            Brand template portal
          </p>
          {/* Ink on the brand surface — anything on Volt/Aqua is Ink, no exceptions. */}
          <h1 className="sp-hero-title" style={{ color: "var(--brand-surface-fg)" }}>
            {view === "signup" ? "Create your account" : view === "forgot" ? "Reset password" : view === "setPassword" ? "Choose a new password" : "Sign in"}
          </h1>
        </div>

        <div className="px-7 py-6 space-y-4">
          {(view === "signin" || view === "signup") && (
            <div
              className="grid grid-cols-2 overflow-hidden" data-radius-control
              style={{ border: "1px solid var(--border-strong)" }}
              role="tablist"
              aria-label="Sign in or create account"
            >
              {([
                ["signin", "Sign in"],
                ["signup", "Create account"],
              ] as const).map(([v, label]) => (
                <button
                  key={v}
                  role="tab"
                  aria-selected={view === v}
                  onClick={() => {
                    setView(v);
                    setError(null);
                    setNotice(null);
                  }}
                  className="py-2 transition-colors"
                  style={{
                    fontSize: "var(--type-label-size)",
                    fontFamily: "var(--font-ui)",
                    // The inverting action pair — NOT --text-primary/--text-on-accent,
                    // which are both ink in light mode (invisible label).
                    ...(view === v
                      ? { background: "var(--fill-action)", color: "var(--text-on-action)" }
                      : { background: "var(--bg-surface)", color: "var(--text-secondary)" }),
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {view === "checkEmail" ? (
            <p style={{ fontSize: "var(--type-label-size)", color: "var(--text-secondary)", lineHeight: 1.6 }}>
              Almost there — we sent a confirmation link to <b style={{ color: "var(--text-primary)" }}>{email}</b>.
              Open it, then come back and sign in.
            </p>
          ) : (
            <>
              {view !== "setPassword" && field("Email", "email", email, setEmail, "email")}
              {view !== "forgot" && (
                field(
                  view === "setPassword" ? "New password" : "Password",
                  "password",
                  password,
                  setPassword,
                  view === "signin" ? "current-password" : "new-password",
                )
              )}
            </>
          )}

          {error && (
            <p className="px-3 py-2" data-radius-control style={{ fontSize: "var(--type-caption-size)", background: "var(--danger-wash)", color: "var(--state-danger)" }}>
              {error}
            </p>
          )}
          {notice && <p style={{ fontSize: "var(--type-caption-size)", color: "var(--state-primary)" }}>{notice}</p>}

          {view === "signin" && (
            <>
              <button className="sp-btn sp-btn-primary w-full" disabled={busy || !email || !password} onClick={() => void signIn()}>
                {busy ? "Signing in…" : "Sign in"}
              </button>
              <button
                className="w-full text-center"
                style={{ fontSize: "var(--type-caption-size)", color: "var(--text-secondary)" }}
                onClick={() => setView("forgot")}
              >
                Forgot password?
              </button>
            </>
          )}
          {view === "signup" && (
            <>
              <button className="sp-btn sp-btn-primary w-full" disabled={busy || !email || password.length < 8} onClick={() => void signUp()}>
                {busy ? "Creating…" : "Create account"}
              </button>
              <p style={{ fontSize: 11, color: "var(--text-muted)" }}>Password must be at least 8 characters.</p>
            </>
          )}
          {view === "forgot" && (
            <>
              <button className="sp-btn sp-btn-primary w-full" disabled={busy || !email} onClick={() => void forgot()}>
                {busy ? "Sending…" : "Send reset link"}
              </button>
              <button style={{ fontSize: "var(--type-caption-size)", color: "var(--text-secondary)" }} onClick={() => setView("signin")}>
                Back to sign in
              </button>
            </>
          )}
          {view === "setPassword" && (
            <button className="sp-btn sp-btn-primary w-full" disabled={busy || password.length < 8} onClick={() => void setNewPassword()}>
              {busy ? "Saving…" : "Save password"}
            </button>
          )}
          {view === "checkEmail" && (
            <button className="sp-btn sp-btn-ghost w-full" onClick={() => setView("signin")}>
              Back to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
