// Shared HTTP plumbing for the Edge Functions: the CORS origin allowlist,
// JSON responses, and error discipline. Runs in Deno (Supabase Edge), but the
// pure helpers are also exercised by vitest under Node — nothing at module
// level may touch Deno.

/** Throwing this anywhere inside a handler produces a clean JSON error with
 * the given status; anything else thrown becomes a logged, generic 500. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const ALLOW_HEADERS = "authorization, x-client-info, apikey, content-type";

function env(name: string): string | undefined {
  const d = (globalThis as { Deno?: { env: { get(n: string): string | undefined } } }).Deno;
  return d?.env?.get(name);
}

/** The origin allowlist, comma-separated, from the ALLOWED_ORIGINS secret.
 * Unset means fail closed: no origin gets CORS headers. */
export function allowlistCsv(): string {
  return env("ALLOWED_ORIGINS") ?? "";
}

/** Match an Origin against one allowlist entry. Entries are exact origins,
 * except that `*` matches one run of [A-Za-z0-9-] — enough for a Vercel
 * preview hash or a localhost port, never a dot, slash, or empty string, so
 * a pattern can widen by one label segment and nothing more. */
export function originMatchesEntry(entry: string, origin: string): boolean {
  const trimmed = entry.trim();
  if (!trimmed) return false;
  if (!trimmed.includes("*")) return trimmed === origin;
  const pattern = trimmed
    .split("*")
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("[A-Za-z0-9-]+");
  return new RegExp(`^${pattern}$`).test(origin);
}

export function originAllowed(csv: string, origin: string): boolean {
  if (!origin) return false;
  return csv.split(",").some((entry) => originMatchesEntry(entry, origin));
}

/** CORS headers for this request: the caller's exact origin echoed back when
 * it is on the allowlist, nothing otherwise (the browser then blocks the
 * response). `Vary: Origin` always, so caches never serve one origin's
 * headers to another. */
export function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  if (!originAllowed(allowlistCsv(), origin)) return { Vary: "Origin" };
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": ALLOW_HEADERS,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

/** Preflight, under the same allowlist as everything else. */
export function handleOptions(req: Request): Response | null {
  if (req.method !== "OPTIONS") return null;
  return new Response("ok", { headers: corsHeadersFor(req) });
}

/** Per-request JSON responder — binds the CORS decision once so every
 * response path (including every early return) carries the same headers. */
export function jsonResponder(req: Request): (body: unknown, status?: number) => Response {
  const cors = corsHeadersFor(req);
  return (body, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });
}

/** Server-side detail stays server-side: log it here (Supabase captures
 * function console output) and send the client a stable message instead. */
export function logError(fn: string, e: unknown): void {
  console.error(`[${fn}]`, e instanceof Error ? (e.stack ?? e.message) : e);
}

/** The generic client-facing 500 body — never a raw exception string. */
export const GENERIC_ERROR = "Something went wrong on our side — try again.";
