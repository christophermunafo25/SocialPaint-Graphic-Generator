import { createRoot } from "react-dom/client";
import "./styles/index.css";
import { supabaseEnvProblems } from "./lib/config/supabaseEnv";
import { ConfigFailureScreen } from "./app/components/ConfigFailureScreen";
import { ErrorBoundary, RootCrashScreen } from "./app/components/ErrorBoundary";
import { captureError, initMonitoring } from "./lib/monitoring";
import { publicLinkToken } from "./lib/publicLink/route";

// Fire-and-forget: DSN-gated, dynamically imported, and every failure path
// inside degrades to console logging — the app never waits on it and never
// fails because of it.
void initMonitoring();

const root = createRoot(document.getElementById("root")!);

const failChunk = (e: unknown) => {
  // A chunk that fails to load (bad deploy, offline mid-update) was an
  // unhandled rejection and a blank page; now it reports and recovers.
  captureError(e, { boundary: "root" });
  root.render(<RootCrashScreen />);
};

// THE public-link branch, and it is here rather than inside App for a
// structural reason: App's auth gate sits four providers deep, under
// AuthProvider, BrandProvider, and RouterProvider, every one of which
// assumes a session and a company. A public route placed anywhere below
// that inherits all of it.
//
// Branching before the import means the authenticated half of the
// application — the auth gate, the store factory, the brand loader — is
// never loaded for an anonymous visitor. Nothing is bypassed; it simply
// does not run. It also keeps the public page in its own chunk, so what
// ships to a stranger is only what the fill surface needs.
//
// The Supabase config check below applies to both branches: the public page
// reaches its Edge Functions through the same project URL.
const linkToken = publicLinkToken(window.location.pathname);

// A production build with missing/malformed Supabase config must never reach
// the app: the store factory would throw into a blank page, and the local
// fallback would silently lose user data. App is imported dynamically because
// a static import would evaluate the store factory before this check runs.
// Config detail is for the operator — console + global error handlers only,
// never the on-screen copy.
if (import.meta.env.PROD && supabaseEnvProblems.length > 0) {
  const detail =
    "Deployment configuration error — this build has no data backend:\n" +
    supabaseEnvProblems.map((p) => `  - ${p}`).join("\n") +
    "\nSet the Supabase environment variables and rebuild (see .env.example).";
  console.error(detail);
  // Surfaces to any installed error reporter via the global `error` event.
  if (typeof reportError === "function") reportError(new Error(detail));
  root.render(<ConfigFailureScreen />);
} else if (linkToken) {
  void import("./app/public/PublicApp")
    .then(({ default: PublicApp }) => root.render(<PublicApp token={linkToken} />))
    .catch(failChunk);
} else {
  void import("./app/App")
    .then(({ default: App }) => {
      // The ROOT boundary: outside every provider, so a crash anywhere the
      // route and canvas boundaries miss — providers included — lands on a
      // full-screen fallback with a reload instead of a white tab.
      root.render(
        <ErrorBoundary level="root" fallback={() => <RootCrashScreen />}>
          <App />
        </ErrorBoundary>,
      );
    })
    .catch(failChunk);
}
