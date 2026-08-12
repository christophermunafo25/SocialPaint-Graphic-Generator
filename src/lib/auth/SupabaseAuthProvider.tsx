import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import type { Company, Role } from "../types";
import { stores } from "../stores";
import { supabase } from "../stores/supabase/client";
import { AuthContext, LS_COMPANY, type AuthState } from "./AuthContext";

interface MembershipRow {
  company_id: string;
  role: Role;
  companies: { id: string; name: string; slug: string; created_at: string } | null;
}

/** Real auth: Supabase Auth session → memberships → company + role.
 *
 * IMPORTANT: supabase-js re-emits auth events on tab refocus (token refresh,
 * repeated SIGNED_IN). Those are NO-OPS for us — reacting to them flipped the
 * app into its loading gate, unmounting the builder/Brand Studio and wiping
 * unsaved work. We therefore key everything on the USER ID, ignore
 * same-user session churn, and only show the loading gate before the first
 * load (or on an actual account switch). */
export function SupabaseAuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [membershipsReady, setMembershipsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);
  const retry = useCallback(() => setTick((t) => t + 1), []);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [roleByCompany, setRoleByCompany] = useState<Record<string, Role>>({});
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    localStorage.getItem(LS_COMPANY),
  );
  const prevUserIdRef = useRef<string | null>(null);

  const userId = session?.user?.id ?? null;

  // Derived, never stored: immune to stale-closure ordering (e.g. onboarding
  // calling refresh() then setCompany() back-to-back).
  const company = useMemo<Company | null>(
    () => companies.find((c) => c.id === selectedId) ?? companies[0] ?? null,
    [companies, selectedId],
  );

  useEffect(() => {
    if (company) localStorage.setItem(LS_COMPANY, company.id);
  }, [company]);

  const loadMemberships = useCallback(async () => {
    const { data, error } = await supabase()
      .from("memberships")
      .select("company_id, role, companies(id, name, slug, created_at)")
      .order("created_at", { ascending: true });
    if (error) throw error;
    const rows = (data as unknown as MembershipRow[]).filter((r) => r.companies);
    const list: Company[] = rows.map((r) => ({
      id: r.companies!.id,
      name: r.companies!.name,
      slug: r.companies!.slug,
      createdAt: r.companies!.created_at,
    }));
    setCompanies(list);
    setRoleByCompany(Object.fromEntries(rows.map((r) => [r.company_id, r.role])));
  }, []);

  useEffect(() => {
    let cancelled = false;
    void supabase()
      .auth.getSession()
      .then(({ data }) => {
        if (!cancelled) setSession(data.session);
      })
      .finally(() => {
        if (!cancelled) setAuthReady(true);
      });
    const { data: sub } = supabase().auth.onAuthStateChange((_event, next) => {
      // Ignore same-user churn (TOKEN_REFRESHED / focus re-emits): keeping the
      // previous object identity means no downstream effects re-run.
      setSession((prev) => {
        if (prev && next && prev.user.id === next.user.id) return prev;
        return next;
      });
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const prevUserId = prevUserIdRef.current;
    prevUserIdRef.current = userId;
    if (!userId) {
      setCompanies([]);
      setRoleByCompany({});
      setMembershipsReady(false);
      return;
    }
    // Only re-gate the UI when the ACCOUNT actually changed.
    if (prevUserId !== userId) setMembershipsReady(false);
    let cancelled = false;
    setError(null);
    loadMemberships()
      .catch((e) => {
        console.error("Membership load failed", e);
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => {
        if (!cancelled) setMembershipsReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, loadMemberships, tick]);

  const setCompany = useCallback(async (companyId: string) => {
    setSelectedId(companyId);
    localStorage.setItem(LS_COMPANY, companyId);
  }, []);

  const signOut = useCallback(async () => {
    await supabase().auth.signOut();
    localStorage.removeItem(LS_COMPANY);
  }, []);

  const loading = !authReady || (userId !== null && !membershipsReady);

  const value = useMemo<AuthState>(
    () => ({
      loading,
      error,
      retry,
      company,
      role: (company && roleByCompany[company.id]) ?? "member",
      user: session?.user ? { id: session.user.id, email: session.user.email ?? "" } : null,
      companies,
      isDevAuth: false,
      backend: stores.backend,
      setCompany,
      setRole: () => undefined, // membership decides
      refresh: loadMemberships,
      signOut,
    }),
    [
      loading,
      error,
      retry,
      company,
      roleByCompany,
      session,
      companies,
      setCompany,
      loadMemberships,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
