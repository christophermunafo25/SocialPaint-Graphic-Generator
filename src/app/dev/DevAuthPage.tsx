import React, { useState } from "react";
import { AUTH_VIEWS, AuthScreen, type AuthView } from "../components/auth/AuthScreen";
import { validateGate, type GateErrors } from "@/lib/auth/gateErrors";

const SAMPLE_EMAIL = "cj@acmehealth.com";

/** /dev/auth?view=&error= — the sign-in gate without Supabase
 * (PHASE-8B §9 D8). Renders AuthScreen with sample values, so the
 * screenshot run and review see every view and error. `error` puts that
 * message under the view's field (the password, or the email on Reset
 * password). Submitting runs the rules and nothing else. Development builds
 * only: the router never returns this route when import.meta.env.DEV is
 * false. */
export function DevAuthPage({ view, error }: { view?: string; error?: string }) {
  const initial = (AUTH_VIEWS as readonly string[]).includes(view ?? "")
    ? (view as AuthView)
    : "signin";
  const [current, setCurrent] = useState<AuthView>(initial);
  const [email, setEmail] = useState(initial === "signin" ? "" : SAMPLE_EMAIL);
  const [password, setPassword] = useState(error ? "••••••••••" : "");
  const [errors, setErrors] = useState<GateErrors>(
    error ? (initial === "forgot" ? { email: error } : { password: error }) : {},
  );
  const [attempt, setAttempt] = useState(0);
  return (
    <AuthScreen
      view={current}
      email={email}
      password={password}
      busy={false}
      errors={errors}
      attempt={attempt}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      onSubmit={() => {
        setErrors(validateGate(current, email, password));
        setAttempt((n) => n + 1);
      }}
      onGo={(v) => {
        setCurrent(v);
        setErrors({});
      }}
    />
  );
}
