import React, { useState } from "react";
import { supabase } from "@/lib/stores/supabase/client";
import { endRecovery } from "@/lib/auth/recovery";
import { gateErrorFor, hasErrors, validateGate, type GateErrors } from "@/lib/auth/gateErrors";
import { captureError } from "@/lib/monitoring";
import { AuthScreen, type AuthView } from "./AuthScreen";

/** The sign-in gate's controller: sign in, sign up and password reset
 * against Supabase (PHASE-8B). Rendered whenever the Supabase backend is
 * active and there is no session, and on New password while a reset is in
 * progress (recovery.ts). AuthScreen draws every view from the state held
 * here (D8).
 *
 * The rules run on submit (D3). A failed call shows our words under the
 * field it belongs to (D4); Supabase's text goes to the console and
 * Sentry only. */
export function AuthPage({ initialView = "signin" }: { initialView?: AuthView }) {
  const [view, setView] = useState<AuthView>(initialView);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<GateErrors>({});
  const [attempt, setAttempt] = useState(0);

  const go = (v: AuthView) => {
    setView(v);
    setErrors({});
  };

  const fail = (next: GateErrors) => {
    setErrors(next);
    setAttempt((n) => n + 1);
  };

  const actions: Partial<Record<AuthView, () => Promise<void>>> = {
    signin: async () => {
      const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      // The session change re-renders the app; nothing else to do.
    },
    signup: async () => {
      const { data, error } = await supabase().auth.signUp({ email: email.trim(), password });
      if (error) throw error;
      if (!data.session) go("checkEmail"); // email confirmation required
    },
    forgot: async () => {
      const { error } = await supabase().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
      go("resetSent");
    },
    setPassword: async () => {
      const { error } = await supabase().auth.updateUser({ password });
      if (error) throw error;
      // The reset link already signed them in: straight into the app (D5).
      endRecovery();
    },
  };

  const submit = async () => {
    const action = actions[view];
    if (!action) return;
    const invalid = validateGate(view, email, password);
    if (hasErrors(invalid)) return fail(invalid);
    setBusy(true);
    setErrors({});
    try {
      await action();
    } catch (e) {
      console.error("Sign-in gate", e);
      captureError(e, { route: "auth" });
      fail(gateErrorFor(view, e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScreen
      view={view}
      email={email}
      password={password}
      busy={busy}
      errors={errors}
      attempt={attempt}
      onEmailChange={(v) => {
        setEmail(v);
        if (errors.email) setErrors((e) => ({ ...e, email: undefined }));
      }}
      onPasswordChange={(v) => {
        setPassword(v);
        if (errors.password) setErrors((e) => ({ ...e, password: undefined }));
      }}
      onSubmit={() => void submit()}
      onGo={go}
    />
  );
}
