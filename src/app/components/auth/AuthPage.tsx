import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/stores/supabase/client";
import { AuthScreen, type AuthView } from "./AuthScreen";

/** The sign-in gate's controller: sign in, sign up and password reset
 * against Supabase. Rendered whenever the Supabase backend is active and
 * there is no session. Also handles the recovery redirect (Supabase fires
 * PASSWORD_RECOVERY after the email link). AuthScreen draws every view from
 * the state held here (PHASE-8B §9 D8). */
export function AuthPage() {
  const [view, setView] = useState<AuthView>("signin");
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

  const go = (v: AuthView) => {
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

  const actions: Partial<Record<AuthView, () => Promise<void>>> = {
    signin: async () => {
      const { error: err } = await supabase().auth.signInWithPassword({ email, password });
      if (err) throw err;
      // Session change re-renders the app; nothing else to do.
    },
    signup: async () => {
      const { data, error: err } = await supabase().auth.signUp({ email, password });
      if (err) throw err;
      if (!data.session) setView("checkEmail"); // email confirmation required
    },
    forgot: async () => {
      const { error: err } = await supabase().auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (err) throw err;
      setNotice("Password reset link sent. Check your email.");
    },
    setPassword: async () => {
      const { error: err } = await supabase().auth.updateUser({ password });
      if (err) throw err;
      setNotice("Password updated.");
      setView("signin");
    },
  };

  return (
    <AuthScreen
      view={view}
      email={email}
      password={password}
      busy={busy}
      error={error}
      notice={notice}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      onSubmit={() => {
        const action = actions[view];
        if (action) void run(action);
      }}
      onGo={go}
    />
  );
}
