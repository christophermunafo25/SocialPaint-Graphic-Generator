// The Canva OAuth return, read from the address Canva sent the browser back
// to. The registered redirect URL carries its own query (`/?canva_oauth=1`),
// and how an authorization server appends `code` and `state` to a URL that
// already has one varies: some merge (`?canva_oauth=1&code=…`), some append
// a second question mark (`?canva_oauth=1?code=…`), some drop the original
// query (`?code=…`). URLSearchParams reads only the first shape, so this
// parses the raw string and accepts all three. The third is only trusted
// when this tab started a Canva connect, recorded in sessionStorage by
// `markCanvaConnectStarted` before the browser left for Canva.
//
// Pure, so vitest covers every shape.

export const CANVA_PENDING_KEY = "sp-canva-oauth-pending";

export interface CanvaReturn {
  code?: string;
  state?: string;
}

const param = (raw: string, name: string): string | undefined => {
  const m = new RegExp(`[?&]${name}=([^&?#]*)`).exec(raw);
  if (!m) return undefined;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
};

/** null when this is not a Canva return. An object without `code` means
 * Canva sent the browser back without granting, which reads as cancelled. */
export function readCanvaReturn(search: string, pendingInThisTab: boolean): CanvaReturn | null {
  const raw = search.startsWith("?") ? search : `?${search}`;
  const marked = /[?&]canva_oauth=1(?=[&?#]|$)/.test(raw);
  const code = param(raw, "code");
  const state = param(raw, "state");
  if (!marked && !(pendingInThisTab && code && state)) return null;
  return { code: code || undefined, state: state || undefined };
}

export function markCanvaConnectStarted(): void {
  try {
    sessionStorage.setItem(CANVA_PENDING_KEY, "1");
  } catch {
    // Storage unavailable: the marker in the URL still works when Canva keeps it.
  }
}

/** Reads and clears the flag, so a later unrelated `code` on this origin
 * is never mistaken for a Canva return. */
export function takeCanvaConnectPending(): boolean {
  try {
    const pending = sessionStorage.getItem(CANVA_PENDING_KEY) === "1";
    sessionStorage.removeItem(CANVA_PENDING_KEY);
    return pending;
  } catch {
    return false;
  }
}
