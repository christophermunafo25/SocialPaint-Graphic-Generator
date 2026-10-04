import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Company, Role } from "../types";
import { stores } from "../stores";

/**
 * Auth boundary. Two providers implement the same AuthState:
 *  - SupabaseAuthProvider (real): Supabase Auth session → memberships →
 *    company + role. Used whenever the Supabase backend is active.
 *  - DevAuthProvider (stub): tenant/role switcher for the zero-setup
 *    localStorage backend.
 * Components only ever consume AuthState.
 */
export interface AuthState {
  loading: boolean;
  /** Set when the identity/membership load failed — the app should show an
   * error state (with `retry`) instead of treating the user as signed out or
   * companyless. */
  error: Error | null;
  /** Re-runs the failed load in place. */
  retry(): void;
  /** null after loading completes → no company for this identity → onboarding. */
  company: Company | null;
  role: Role;
  user: { id: string; email: string } | null; // null in dev mode / signed out
  companies: Company[]; // dev: all companies; real: the user's companies
  /** The person's role in one of their workspaces (the Workspaces card).
   * Real auth reads it from the memberships it already loads; the dev
   * backend has one role for every workspace. Null for a workspace that is
   * not theirs. */
  roleFor(companyId: string): Role | null;
  isDevAuth: boolean;
  backend: "supabase" | "local";
  setCompany(companyId: string): Promise<void>;
  /** Dev-only role toggle; no-op under real auth (role comes from membership). */
  setRole(role: Role): void;
  /** Re-reads companies/memberships (e.g. after onboarding creates one). */
  refresh(): Promise<void>;
  /** Real auth only. */
  signOut?(): Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);

export const LS_COMPANY = "brand-portal-company";
const LS_ROLE = "brand-portal-dev-role";

export function DevAuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);
  const retry = useCallback(() => setTick((t) => t + 1), []);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [company, setCompanyState] = useState<Company | null>(null);
  const [role, setRoleState] = useState<Role>(
    (localStorage.getItem(LS_ROLE) as Role | null) ?? "admin",
  );

  const load = useCallback(async () => {
    const list = await stores.companies.list();
    setCompanies(list);
    const savedId = localStorage.getItem(LS_COMPANY);
    const selected = list.find((c) => c.id === savedId) ?? list[0] ?? null;
    setCompanyState(selected);
    if (selected) localStorage.setItem(LS_COMPANY, selected.id);
    else localStorage.removeItem(LS_COMPANY);
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    load()
      .catch((e) => {
        console.error("Auth load failed", e);
        if (alive) setError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [load, tick]);

  const setCompany = useCallback(async (companyId: string) => {
    const c = (await stores.companies.get(companyId)) ?? null;
    setCompanyState(c);
    if (c) localStorage.setItem(LS_COMPANY, c.id);
  }, []);

  const setRole = useCallback((r: Role) => {
    setRoleState(r);
    localStorage.setItem(LS_ROLE, r);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      loading,
      error,
      retry,
      company,
      role,
      user: null,
      companies,
      roleFor: (id: string) => (companies.some((c) => c.id === id) ? role : null),
      isDevAuth: true,
      backend: stores.backend,
      setCompany,
      setRole,
      refresh: load,
    }),
    [loading, error, retry, company, role, companies, setCompany, setRole, load],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside an auth provider");
  return ctx;
}
