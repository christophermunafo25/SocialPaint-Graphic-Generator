// Build gate: refuse to produce a production bundle without a complete,
// well-formed Supabase configuration. A broken deploy should fail here (CI),
// not in a user's browser. Runs via `npm run build` before `vite build`.
//
// Escape hatch for intentional unconfigured builds (e.g. testing the runtime
// failure screen locally): ALLOW_UNCONFIGURED_BUILD=1 npm run build
//
// Keep the validation rules in sync with src/lib/config/supabaseEnv.ts.

import { loadEnv } from "vite";
import process from "node:process";

if (process.env.ALLOW_UNCONFIGURED_BUILD === "1") {
  console.warn(
    "[check-production-env] ALLOW_UNCONFIGURED_BUILD=1 — skipping the Supabase config check. " +
      "This bundle will refuse to boot in production.",
  );
  process.exit(0);
}

// Same sources `vite build` will use: .env / .env.production / *.local files
// merged with process.env (which is how Vercel and CI provide values).
const env = loadEnv("production", process.cwd(), "VITE_");
const url = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_ANON_KEY;

const problems = [];

if (!url) {
  problems.push("VITE_SUPABASE_URL is not set");
} else {
  try {
    if (new URL(url).protocol !== "https:")
      problems.push("VITE_SUPABASE_URL must be an https:// URL");
  } catch {
    problems.push("VITE_SUPABASE_URL is not a valid URL");
  }
}

if (!anonKey) {
  problems.push("VITE_SUPABASE_ANON_KEY is not set");
} else if (
  !/^eyJ[\w-]*\.[\w-]+\.[\w-]+$/.test(anonKey) &&
  !/^sb_publishable_[\w-]+$/.test(anonKey)
) {
  problems.push(
    "VITE_SUPABASE_ANON_KEY does not look like a Supabase anon key (JWT or sb_publishable_…)",
  );
}

if (problems.length > 0) {
  console.error(
    "[check-production-env] Refusing to build a production bundle without a data backend:\n" +
      problems.map((p) => `  - ${p}`).join("\n") +
      "\nSet the variables (see .env.example), or pass ALLOW_UNCONFIGURED_BUILD=1 for an intentional local build.",
  );
  process.exit(1);
}
