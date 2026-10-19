import React, { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import type { GateErrors, GateView } from "@/lib/auth/gateErrors";
import { PRIVACY, TERMS } from "@/lib/legal";
import { PreAppShell } from "../PreAppShell";
import { Button, Field, Input, focusFirstInvalid } from "../primitives";
import { ComposerIllustration } from "./AuthPanel";

export type AuthView = GateView;

export const AUTH_VIEWS: readonly AuthView[] = [
  "signin",
  "signup",
  "forgot",
  "resetSent",
  "checkEmail",
  "setPassword",
];

export interface AuthScreenProps {
  view: AuthView;
  email: string;
  password: string;
  busy: boolean;
  /** Messages under their fields (PHASE-8B §9 D3, D4). */
  errors: GateErrors;
  /** Bumped on each submit that came back with errors, so focus moves to
   * the first field in error then, and not while the person types. */
  attempt: number;
  onEmailChange(email: string): void;
  onPasswordChange(password: string): void;
  /** The view's action (sign in, sign up, send the link, save). */
  onSubmit(): void;
  /** Move to another view; the controller clears the errors. */
  onGo(view: AuthView): void;
}

const TITLE: Record<AuthView, string> = {
  signin: "Let’s get painting",
  signup: "Create your account",
  forgot: "Reset password",
  resetSent: "Check your email",
  checkEmail: "Check your email",
  setPassword: "Choose a new password",
};

const SUBMIT: Partial<Record<AuthView, string>> = {
  signin: "Sign in",
  signup: "Create account",
  forgot: "Send reset link",
  setPassword: "Save password",
};

/** The sign-in gate (Figma 194:2, PHASE-8B-SCREENS.md), from props alone:
 * every view and error renders without Supabase, so `/dev/auth`, the
 * screenshot run and the tests see what a signed-out visitor sees.
 * AuthPage is the controller that owns the Supabase calls.
 *
 * Each form view is one <form>: Enter submits it, and the rules run on
 * submit with their messages under the fields (D3). Submit stays enabled;
 * while a request runs it shows the spinner and holds (D10). Always Light
 * (D1), beside the composer illustration (D6). */
export function AuthScreen({
  view,
  email,
  password,
  busy,
  errors,
  attempt,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  onGo,
}: AuthScreenProps) {
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (attempt > 0 && formRef.current) focusFirstInvalid(formRef.current);
  }, [attempt]);

  const link = (label: string, to: AuthView) => (
    <button
      type="button"
      className="ui-reset ui-ring t-label-m sp-auth-link"
      onClick={() => onGo(to)}
    >
      {label}
    </button>
  );

  const emailField = (
    <Field label="Email" error={errors.email}>
      <Input
        type="email"
        value={email}
        autoComplete="email"
        autoFocus
        onChange={(e) => onEmailChange(e.target.value)}
      />
    </Field>
  );

  const passwordField = (
    <Field label={view === "setPassword" ? "New password" : "Password"} error={errors.password}>
      <Input
        type="password"
        value={password}
        autoComplete={view === "signin" ? "current-password" : "new-password"}
        autoFocus={view === "setPassword"}
        onChange={(e) => onPasswordChange(e.target.value)}
      />
    </Field>
  );

  const sent = view === "checkEmail" || view === "resetSent";

  return (
    <PreAppShell panel={<ComposerIllustration />}>
      <h1 className="t-title-page sp-auth-title">{TITLE[view]}</h1>

      {sent ? (
        <>
          <p className="t-body-m sp-auth-message">
            {view === "checkEmail" ? "We sent a confirmation link to " : "We sent a reset link to "}
            <span className="t-label-l sp-auth-strong">{email}</span>
            {view === "checkEmail"
              ? ". Open it, then come back and sign in."
              : ". Open it to choose a new password."}
          </p>
          <Button
            kind="primary"
            size="lg"
            className="sp-auth-submit"
            onClick={() => onGo("signin")}
          >
            Back to sign in
          </Button>
        </>
      ) : (
        <form
          ref={formRef}
          className="sp-auth-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (!busy) onSubmit();
          }}
        >
          <div className="sp-auth-fields">
            {view !== "setPassword" && emailField}
            {view === "signin" ? (
              <div className="sp-auth-password">
                {passwordField}
                <div className="sp-auth-forgot">{link("Forgot password?", "forgot")}</div>
              </div>
            ) : (
              view !== "forgot" && passwordField
            )}
          </div>
          <div className="sp-auth-actions">
            <Button
              type="submit"
              kind="primary"
              size="lg"
              className="sp-auth-submit"
              icon={busy ? SpinningLoader : undefined}
              aria-busy={busy || undefined}
              aria-disabled={busy || undefined}
            >
              {SUBMIT[view]}
            </Button>
            {view === "signup" && (
              <p className="t-caption-s sp-auth-consent">
                By creating an account, you agree to the{" "}
                <a className="t-label-xs sp-auth-strong" href={TERMS.href}>
                  {TERMS.label}
                </a>{" "}
                and{" "}
                <a className="t-label-xs sp-auth-strong" href={PRIVACY.href}>
                  {PRIVACY.label}
                </a>
                .
              </p>
            )}
            {view === "signin" && (
              <p className="sp-auth-switch">
                <span className="t-body-s sp-auth-muted">Don’t have an account?</span>
                {link("Sign up", "signup")}
              </p>
            )}
            {view === "signup" && (
              <p className="sp-auth-switch">
                <span className="t-body-s sp-auth-muted">Already have an account?</span>
                {link("Sign in", "signin")}
              </p>
            )}
            {view === "forgot" && (
              <p className="sp-auth-switch">{link("Back to sign in", "signin")}</p>
            )}
          </div>
        </form>
      )}
    </PreAppShell>
  );
}

/** The busy spinner in the button's icon slot (D10). */
function SpinningLoader(props: React.ComponentProps<typeof Loader2>) {
  return <Loader2 {...props} className={`${props.className ?? ""} sp-auth-spin`} />;
}
