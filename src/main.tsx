import { createRoot } from "react-dom/client";
import "./styles/index.css";
import { supabaseEnvProblems } from "./lib/config/supabaseEnv";
import { ConfigFailureScreen } from "./app/components/ConfigFailureScreen";
import { ErrorBoundary, RootCrashScreen } from "./app/components/ErrorBoundary";
import { captureError, initMonitoring } from "./lib/monitoring";

// Fire-and-forget: DSN-gated, dynamically imported, and every failure path
// inside degrades to console logging — the app never waits on it and never
// fails because of it.
void initMonitoring();

const root = createRoot(document.getElementById("root")!);

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
    .catch((e) => {
      // A chunk that fails to load (bad deploy, offline mid-update) was an
      // unhandled rejection and a blank page; now it reports and recovers.
      captureError(e, { boundary: "root" });
      root.render(<RootCrashScreen />);
    });
}
