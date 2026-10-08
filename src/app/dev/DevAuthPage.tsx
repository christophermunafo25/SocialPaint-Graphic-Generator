import React, { useState } from "react";
import { AUTH_VIEWS, AuthScreen, type AuthView } from "../components/auth/AuthScreen";

/** /dev/auth?view=&error= — the sign-in gate without Supabase
 * (PHASE-8B §9 D8). Renders AuthScreen with sample values, so the
 * screenshot run and review see every view and error. Development builds
 * only: the router never returns this route when import.meta.env.DEV is
 * false. Typing works; submitting does nothing. */
export function DevAuthPage({ view, error }: { view?: string; error?: string }) {
  const initial = (AUTH_VIEWS as readonly string[]).includes(view ?? "")
    ? (view as AuthView)
    : "signin";
  const [current, setCurrent] = useState<AuthView>(initial);
  const [email, setEmail] = useState(initial === "signin" ? "" : "cj@acmehealth.com");
  const [password, setPassword] = useState("");
  return (
    <AuthScreen
      view={current}
      email={email}
      password={password}
      busy={false}
      error={error ?? null}
      notice={null}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      onSubmit={() => {}}
      onGo={setCurrent}
    />
  );
}
