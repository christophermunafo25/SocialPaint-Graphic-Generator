import React, { useEffect, useId, useState } from "react";
import { supabase } from "@/lib/stores/supabase/client";
import { BrandMark } from "../BrandMark";
import { PreAppShell } from "../PreAppShell";
import gateOrbit from "@/assets/socialpaint/gate-orbit.webp";

type View = "signin" | "signup" | "forgot" | "checkEmail" | "setPassword";

/** Sign in / sign up / password reset ("Auth · Gate Light", frames 123:3 →
 * 123:8, 2026-09-18). Rendered whenever the Supabase backend is active and
 * there is no session. Also handles the recovery redirect (Supabase fires
 * PASSWORD_RECOVERY after the email link).
 *
 * Every view is the same solo light card over the orbit artwork — the
 * split/dark hero door is retired here but intact in the shell for anything
 * still on it. Only the headline and the form contents change between
 * views. Sign up is a distinct view reached from the footer link, not a
 * tab: the old signin/signup tablist is gone with the header it sat under.
 * Each view is one <form>, so Enter submits that view's action and, because
 * the submit button carries the view's disabled rule, Enter obeys the rule
 * too. */
export function AuthPage() {
  const [view, setView] = useState<View>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const emailId = useId();
  const passwordId = useId();
  const passwordHelpId = useId();

  useEffect(() => {
    const { data: sub } = supabase().auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setView("setPassword");
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const go = (v: View) => {
    setView(v);
    setError(null);
    setNotice(null);
  };

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
      setNotice("Password reset link sent. Check your email.");
    });

  const setNewPassword = () =>
    run(async () => {
      const { error: err } = await supabase().auth.updateUser({ password });
      if (err) throw err;
      setNotice("Password updated.");
      setView("signin");
    });

  // One action and one disabled rule per view; the submit button and the
  // form's Enter path share both.
  const action: Partial<Record<View, () => Promise<void>>> = {
    signin: signIn,
    signup: signUp,
    forgot,
    setPassword: setNewPassword,
  };
  const ready =
    view === "signin"
      ? !!email && !!password
      : view === "signup"
        ? !!email && password.length >= 8
        : view === "forgot"
          ? !!email
          : view === "setPassword"
            ? password.length >= 8
            : false;
  const canSubmit = ready && !busy;

  const headline =
    view === "signup"
      ? "Create your account"
      : view === "forgot"
        ? "Reset password"
        : view === "setPassword"
          ? "Choose a new password"
          : view === "checkEmail"
            ? "Check your email"
            : "Let’s get painting!";

  const submitLabel =
    view === "signup"
      ? busy
        ? "Creating…"
        : "Create Account"
      : view === "forgot"
        ? busy
          ? "Sending…"
          : "Send Reset Link"
        : view === "setPassword"
          ? busy
            ? "Saving…"
            : "Save Password"
          : busy
            ? "Signing in…"
            : "Sign In";

  const emailField = (
    <div className="sp-gate__field">
      <label htmlFor={emailId} className="sp-gate__label">
        Email
      </label>
      <input
        id={emailId}
        type="email"
        value={email}
        autoComplete="email"
        autoFocus
        onChange={(e) => setEmail(e.target.value)}
        className="sp-input sp-input-lg"
      />
    </div>
  );

  const passwordField = (
    <div className="sp-gate__field">
      <label htmlFor={passwordId} className="sp-gate__label">
        {view === "setPassword" ? "New password" : "Password"}
      </label>
      <input
        id={passwordId}
        type="password"
        value={password}
        autoComplete={view === "signin" ? "current-password" : "new-password"}
        autoFocus={view === "setPassword"}
        aria-describedby={view === "signup" ? passwordHelpId : undefined}
        onChange={(e) => setPassword(e.target.value)}
        className="sp-input sp-input-lg"
      />
      {/* The rule sits under the field as help, present before the user
          submits rather than after they fail. No strength meter. */}
      {view === "signup" && (
        <p id={passwordHelpId} className="sp-gate__help">
          At least 8 characters.
        </p>
      )}
    </div>
  );

  const feedback = (
    <>
      {error && (
        <p className="sp-gate__error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="sp-gate__notice" role="status">
          {notice}
        </p>
      )}
    </>
  );

  return (
    <PreAppShell layout="solo" tone="light" backdrop={gateOrbit}>
      <div className="sp-gate__intro">
        <BrandMark width={64} />
        <h1 className="sp-hero-title sp-gate__title">{headline}</h1>
      </div>

      {view === "checkEmail" ? (
        <div className="sp-gate__form sp-gate__form--check">
          {/* A dead end by design, and the screen a new user stares at for
              a minute: the address on its own line, plain body colour, no
              error styling anywhere near it. */}
          <p className="sp-gate__footer">We sent a confirmation link to</p>
          <p className="sp-gate__address">{email}</p>
          <p className="sp-gate__footer">Open it, then come back and sign in.</p>
          <button
            type="button"
            className="sp-btn sp-btn-primary sp-btn-lg"
            onClick={() => go("signin")}
          >
            Back to Sign In
          </button>
        </div>
      ) : (
        <form
          className="sp-gate__form"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) void action[view]?.();
          }}
        >
          {view !== "setPassword" && emailField}
          {view !== "forgot" && passwordField}
          {feedback}
          <button type="submit" className="sp-btn sp-btn-primary sp-btn-lg" disabled={!canSubmit}>
            {submitLabel}
          </button>
          {view === "signin" && (
            <button
              type="button"
              className="sp-gate__link"
              style={{ alignSelf: "center" }}
              onClick={() => go("forgot")}
            >
              Forgot password?
            </button>
          )}
        </form>
      )}

      {view === "signin" && (
        <p className="sp-gate__footer">
          Don’t have an account?{" "}
          <button type="button" className="sp-gate__link" onClick={() => go("signup")}>
            Sign up
          </button>
        </p>
      )}
      {view === "signup" && (
        <p className="sp-gate__footer">
          Already have an account?{" "}
          <button type="button" className="sp-gate__link" onClick={() => go("signin")}>
            Sign in
          </button>
        </p>
      )}
      {view === "forgot" && (
        <p className="sp-gate__footer">
          <button type="button" className="sp-gate__link" onClick={() => go("signin")}>
            Back to sign in
          </button>
        </p>
      )}
    </PreAppShell>
  );
}
