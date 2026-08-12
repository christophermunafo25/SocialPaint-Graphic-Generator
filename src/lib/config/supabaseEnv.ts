// Supabase configuration, read once at module load. Vite inlines VITE_* values
// at `vite build` time, so a production bundle's configuration is fixed when it
// is built — there is no runtime injection path.
//
// Validation checks shape, not just presence: a typo'd value is a likelier
// failure than an absent one, and `Boolean(url && anonKey)` would happily
// accept a truncated key or an http URL. Keep these rules in sync with
// scripts/check-production-env.mjs, which runs the same checks before a
// production build.

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

function urlProblem(value: string | undefined): string | null {
  if (!value) return "VITE_SUPABASE_URL is not set";
  try {
    if (new URL(value).protocol !== "https:") return "VITE_SUPABASE_URL must be an https:// URL";
  } catch {
    return "VITE_SUPABASE_URL is not a valid URL";
  }
  return null;
}

function anonKeyProblem(value: string | undefined): string | null {
  if (!value) return "VITE_SUPABASE_ANON_KEY is not set";
  // Legacy anon keys are JWTs (three base64url segments); newer Supabase
  // projects issue `sb_publishable_…` keys. Anything else is a paste error.
  const jwtShaped = /^eyJ[\w-]*\.[\w-]+\.[\w-]+$/.test(value);
  const publishableShaped = /^sb_publishable_[\w-]+$/.test(value);
  if (!jwtShaped && !publishableShaped) {
    return "VITE_SUPABASE_ANON_KEY does not look like a Supabase anon key (JWT or sb_publishable_…)";
  }
  return null;
}

/** Empty when the app has a complete, well-formed Supabase configuration. */
export const supabaseEnvProblems: string[] = [
  urlProblem(supabaseUrl),
  anonKeyProblem(supabaseAnonKey),
].filter((p): p is string => p !== null);

export const isSupabaseConfigured = supabaseEnvProblems.length === 0;
