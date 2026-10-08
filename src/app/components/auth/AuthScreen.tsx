import React, { useId } from "react";
import { BrandMark } from "../BrandMark";
import { PreAppShell } from "../PreAppShell";
import gateOrbit from "@/assets/socialpaint/gate-orbit.webp";

export type AuthView = "signin" | "signup" | "forgot" | "checkEmail" | "setPassword";

export const AUTH_VIEWS: readonly AuthView[] = [
  "signin",
  "signup",
  "forgot",
  "checkEmail",
  "setPassword",
];

export interface AuthScreenProps {
  view: AuthView;
  email: string;
  password: string;
  busy: boolean;
  error: string | null;
  notice: string | null;
  onEmailChange(email: string): void;
  onPasswordChange(password: string): void;
  /** The view's action (sign in, sign up, send the link, save). */
  onSubmit(): void;
  /** Move to another view; the controller clears errors and notices. */
  onGo(view: AuthView): void;
}

/** The sign-in gate's screens, from props alone (PHASE-8B §9 D8): every view
 * and error renders without Supabase, so `/dev/auth`, the screenshot run and
 * the tests see what a signed-out visitor sees. AuthPage is the controller
 * that owns the Supabase calls.
 *
 * Each view is one <form>, so Enter submits that view's action, and because
 * the submit button carries the view's disabled rule, Enter obeys it too. */
export function AuthScreen({
  view,
  email,
  password,
  busy,
  error,
  notice,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  onGo,
}: AuthScreenProps) {
  const emailId = useId();
  const passwordId = useId();
  const passwordHelpId = useId();

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
        onChange={(e) => onEmailChange(e.target.value)}
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
        onChange={(e) => onPasswordChange(e.target.value)}
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
            onClick={() => onGo("signin")}
          >
            Back to Sign In
          </button>
        </div>
      ) : (
        <form
          className="sp-gate__form"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) onSubmit();
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
              onClick={() => onGo("forgot")}
            >
              Forgot password?
            </button>
          )}
        </form>
      )}

      {view === "signin" && (
        <p className="sp-gate__footer">
          Don’t have an account?{" "}
          <button type="button" className="sp-gate__link" onClick={() => onGo("signup")}>
            Sign up
          </button>
        </p>
      )}
      {view === "signup" && (
        <p className="sp-gate__footer">
          Already have an account?{" "}
          <button type="button" className="sp-gate__link" onClick={() => onGo("signin")}>
            Sign in
          </button>
        </p>
      )}
      {view === "forgot" && (
        <p className="sp-gate__footer">
          <button type="button" className="sp-gate__link" onClick={() => onGo("signin")}>
            Back to sign in
          </button>
        </p>
      )}
    </PreAppShell>
  );
}
