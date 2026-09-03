import React from "react";
import { DevAuthProvider, useAuth } from "@/lib/auth/AuthContext";
import { SupabaseAuthProvider } from "@/lib/auth/SupabaseAuthProvider";
import { stores } from "@/lib/stores";
import { AuthPage } from "./components/auth/AuthPage";
import { PeopleAdmin } from "./components/admin/PeopleAdmin";
import { BrandProvider, useBrand } from "@/lib/brand/BrandContext";
import { ColorSchemeProvider } from "@/lib/colorScheme";
import { RouterProvider, useRouter } from "./router";
import { AppShell } from "./components/AppShell";
import { DevBackendBanner } from "./components/DevBackendBanner";
import { ErrorState } from "./components/ErrorState";
import { Portal } from "./components/Portal";
import { TemplateUsePage } from "./components/TemplateUsePage";
import { BulkFillPage } from "./components/bulk/BulkFillPage";
import { GeneratePage } from "./components/generate/GeneratePage";
import { OnboardingWizard } from "./components/onboarding/OnboardingWizard";
import { AdminTemplates } from "./components/admin/AdminTemplates";
import { TemplateBuilder } from "./components/builder/TemplateBuilder";
import { BrandStudio } from "./components/admin/BrandStudio";
import { Dashboard } from "./components/admin/Dashboard";
import { SettingsAdmin } from "./components/admin/SettingsAdmin";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { setMonitoringContext } from "@/lib/monitoring";

/** Keeps the ambient error-report context current: route name, company id,
 * opaque user id, role. Ids and enums only — never email or name. */
function MonitoringBridge() {
  const { company, role, user } = useAuth();
  const { route } = useRouter();
  React.useEffect(() => {
    setMonitoringContext({
      route: route.name,
      companyId: company?.id,
      userId: user?.id,
      role: role ?? undefined,
    });
  }, [route.name, company?.id, user?.id, role]);
  return null;
}

/** Completes the Canva OAuth round-trip: the authorize redirect lands on
 * `/?canva_oauth=1&code=…&state=…`; this exchanges the pair server-side (the
 * PKCE verifier never left the Edge Function) and cleans the URL. */
function useCanvaOAuthReturn(companyId: string | undefined) {
  const [notice, setNotice] = React.useState<string | null>(null);
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("canva_oauth") !== "1" || !companyId) return;
    const code = params.get("code");
    const state = params.get("state");
    window.history.replaceState({}, "", window.location.pathname);
    if (!code || !state) {
      setNotice("Canva connection was cancelled.");
      return;
    }
    stores.designImport
      .canvaConnectCallback(companyId, code, state, `${window.location.origin}/?canva_oauth=1`)
      .then(() => setNotice("Canva connected. Open Auto-build to use it."))
      .catch((e) => setNotice(e instanceof Error ? e.message : "Canva connection failed."));
  }, [companyId]);
  return { notice, dismiss: () => setNotice(null) };
}

function Screen() {
  const { loading, error, retry, company, role, user, backend } = useAuth();
  const brand = useBrand();
  const { route } = useRouter();
  const canvaReturn = useCanvaOAuthReturn(company?.id);

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--background)" }}
      >
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
          Loading…
        </p>
      </div>
    );
  }

  // A failed identity/membership load is an ERROR — never treat it as
  // "signed out" or "no company" (both would point the user at the wrong fix).
  if (error) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--background)" }}
      >
        <ErrorState
          title="We couldn't load your account."
          detail="Check your connection and try again."
          onRetry={retry}
        />
      </div>
    );
  }

  // Real auth: no session → sign in / sign up.
  if (backend === "supabase" && !user) {
    return <AuthPage />;
  }

  // Same rule for the brand kit: don't render brand-aware screens against a
  // kit that failed to load.
  if (!brand.loading && brand.error) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--background)" }}
      >
        <ErrorState
          title="We couldn't load your brand."
          detail="Check your connection and try again."
          onRetry={brand.retry}
        />
      </div>
    );
  }

  // No company for this identity (or "Create company") → onboarding.
  if (!company || route.name === "onboarding") {
    return <OnboardingWizard firstRun={!company} />;
  }

  const adminOnly = (node: React.ReactNode) => (role === "admin" ? node : <Portal />);

  return (
    <AppShell>
      {canvaReturn.notice && (
        <div className="sp-toast" role="status" aria-live="polite">
          <span
            style={{
              fontSize: "var(--type-label-size)",
              fontWeight: 500,
              color: "var(--text-primary)",
            }}
          >
            {canvaReturn.notice}
          </span>
          <button
            onClick={canvaReturn.dismiss}
            aria-label="Dismiss"
            style={{ color: "var(--text-muted)" }}
          >
            ×
          </button>
        </div>
      )}
      {/* The ROUTE boundary: a crash inside any screen leaves the shell and
          sidebar standing, so the user can retry or simply go somewhere
          else. Navigation resets a crashed boundary via resetKeys. */}
      <ErrorBoundary
        level="route"
        context={{ route: route.name }}
        resetKeys={[route.name, "templateId" in route ? route.templateId : null]}
        fallback={(retry) => (
          <ErrorState
            title="This screen ran into a problem."
            detail="Everything up to your last save is safe. Try again, or head somewhere else from the sidebar."
            onRetry={retry}
          />
        )}
      >
        {route.name === "portal" && <Portal />}
        {route.name === "template" && <TemplateUsePage templateId={route.templateId} />}
        {route.name === "bulk" && adminOnly(<BulkFillPage templateId={route.templateId} />)}
        {route.name === "generate" && <GeneratePage templateIdHint={route.templateId} />}
        {route.name === "adminTemplates" && adminOnly(<AdminTemplates />)}
        {route.name === "builder" &&
          adminOnly(
            // Keyed: the builder's saved-id and wizard state assume one
            // template per mount, and create-a-version navigates builder →
            // builder (the freshly duplicated copy).
            <TemplateBuilder
              key={route.templateId ?? "new"}
              templateId={route.templateId}
              reflowParam={route.reflow ?? null}
            />,
          )}
        {route.name === "brandStudio" && adminOnly(<BrandStudio category={route.category} />)}
        {route.name === "dashboard" && adminOnly(<Dashboard />)}
        {route.name === "people" && adminOnly(<PeopleAdmin />)}
        {/* NOT adminOnly: members reach Account (theme, sign out). The page
            itself gates the admin sections and lands a member on Account. */}
        {route.name === "settings" && <SettingsAdmin section={route.section} />}
      </ErrorBoundary>
    </AppShell>
  );
}

export default function App() {
  const AuthProvider = stores.backend === "supabase" ? SupabaseAuthProvider : DevAuthProvider;
  return (
    <ColorSchemeProvider>
      <AuthProvider>
        <BrandProvider>
          <RouterProvider>
            <MonitoringBridge />
            <Screen />
            <DevBackendBanner />
          </RouterProvider>
        </BrandProvider>
      </AuthProvider>
    </ColorSchemeProvider>
  );
}
