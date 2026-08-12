// Error reporting: boundaries and handlers call captureError; when a Sentry
// DSN is configured the report is forwarded, otherwise it stays on the
// console. Everything here obeys two rules:
//
//  1. Monitoring must never become a second failure mode. The SDK is
//     dynamically imported and DSN-gated: no DSN, failed chunk load, or a
//     throwing reporter all degrade to console logging. captureError can be
//     called from any state and never throws.
//  2. No customer content leaves in a payload. Context is limited to opaque
//     ids and enums; the scrubbers below strip field values, captions,
//     asset/storage URLs, data URIs, query strings (OAuth codes), emails,
//     and console breadcrumbs from every outgoing event — defense in depth
//     behind the ids-only CaptureContext type.

import type { Breadcrumb, ErrorEvent as SentryErrorEvent } from "@sentry/react";

export type BoundaryLevel = "root" | "route" | "canvas" | "field";

export interface CaptureContext {
  /** Which boundary (or handler) caught it. */
  boundary?: BoundaryLevel;
  /** Route NAME only ("builder", "portal") — never a full URL. */
  route?: string;
  companyId?: string;
  templateId?: string;
  /** Auth user id (opaque). Never email, never display name. */
  userId?: string;
  role?: string;
  fieldId?: string;
  /** Field TYPE ("text", "image") — the label is customer content. */
  fieldType?: string;
  componentStack?: string;
}

/** Ambient context, kept current by MonitoringBridge (App) so every capture
 * carries route/company/role even when the throw site knows none of it. */
let ambient: CaptureContext = {};

/** The loaded SDK, or null when disabled/unavailable. */
let sentry: typeof import("@sentry/react") | null = null;

/** Boot-time init, fire-and-forget from main.tsx. DSN absent → reporting
 * stays off and the app runs exactly as before; the SDK chunk failing to
 * load degrades the same way. Never throws, never blocks render. */
export async function initMonitoring(): Promise<void> {
  try {
    const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
    if (!dsn) return;
    const Sentry = await import("@sentry/react");
    Sentry.init({
      dsn,
      // Injected by vite.config.ts from the git SHA — the same value the
      // build plugin tags the uploaded source maps with, so stack traces
      // resolve against the right release.
      release: (import.meta.env.VITE_APP_RELEASE as string | undefined) || undefined,
      // Dev noise never pollutes production issues.
      environment:
        (import.meta.env.VITE_SENTRY_ENVIRONMENT as string | undefined) || import.meta.env.MODE,
      sendDefaultPii: false,
      // Errors only — no performance tracing, no replays.
      tracesSampleRate: 0,
      beforeSend: scrubEvent,
      beforeBreadcrumb: scrubBreadcrumb,
    });
    sentry = Sentry;
    pushAmbientToSentry();
  } catch {
    // Rule 1: a reporter that can't start must not take the app with it.
  }
}

export function setMonitoringContext(patch: CaptureContext): void {
  ambient = { ...ambient, ...patch };
  pushAmbientToSentry();
}

function pushAmbientToSentry(): void {
  if (!sentry) return;
  try {
    // Opaque id only — no email, no name, no IP (sendDefaultPii false).
    sentry.setUser(ambient.userId ? { id: ambient.userId } : null);
    sentry.setTags({
      company_id: ambient.companyId,
      route: ambient.route,
      role: ambient.role,
    });
  } catch {
    // Context is best-effort.
  }
}

/** A field crashing inside a drag can re-throw every animation frame; the
 * same signature within this window reports once. */
const DEDUPE_MS = 5000;
const recent = new Map<string, number>();

export function captureError(error: unknown, context: CaptureContext = {}): void {
  try {
    const merged = { ...ambient, ...context };
    const message = error instanceof Error ? error.message : String(error);
    const key = `${merged.boundary ?? ""}:${merged.fieldId ?? ""}:${message}`;
    const now = Date.now();
    const last = recent.get(key);
    if (last !== undefined && now - last < DEDUPE_MS) return;
    recent.set(key, now);
    if (recent.size > 50) {
      for (const [k, t] of recent) if (now - t > DEDUPE_MS) recent.delete(k);
    }

    console.error("[socialpaint]", error, merged);

    sentry?.captureException(error instanceof Error ? error : new Error(message), {
      tags: {
        boundary: merged.boundary,
        route: merged.route,
        company_id: merged.companyId,
        template_id: merged.templateId,
        field_type: merged.fieldType,
        role: merged.role,
      },
      contexts: {
        socialpaint: {
          field_id: merged.fieldId,
          component_stack: merged.componentStack?.slice(0, 4000),
        },
      },
    });
  } catch {
    // Rule 1: a broken reporter must never take the app down with it.
  }
}

// ---------------------------------------------------------------------------
// Scrubbing — customer content must not leave in an error payload.
// Exported for tests; wired into beforeSend / beforeBreadcrumb above.
// ---------------------------------------------------------------------------

/** Inlined images (field values, crops) — enormous and pure content. */
const DATA_URI = /data:[a-z0-9/+.-]+;base64,[A-Za-z0-9+/=]{16,}/gi;
/** Supabase Storage objects: template backgrounds, brand assets, uploads. */
const STORAGE_URL = /https?:\/\/[^\s"'()<>]*\/storage\/v1\/[^\s"'()<>]*/gi;
/** Email addresses, wherever a library slipped one into a message. */
const EMAIL = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

export function scrubText(s: string): string {
  return s
    .replace(DATA_URI, "[data-uri]")
    .replace(STORAGE_URL, "[storage-url]")
    .replace(EMAIL, "[email]");
}

/** Query strings carry OAuth codes and signed-URL tokens — never send. */
export function scrubUrl(url: string): string {
  const bare = url.split(/[?#]/)[0];
  return scrubText(bare);
}

export function scrubEvent(event: SentryErrorEvent): SentryErrorEvent {
  try {
    if (event.message) event.message = scrubText(event.message);
    for (const ex of event.exception?.values ?? []) {
      if (ex.value) ex.value = scrubText(ex.value);
    }
    if (event.request?.url) event.request.url = scrubUrl(event.request.url);
    if (event.request?.query_string) delete event.request.query_string;
    if (event.user) event.user = event.user.id ? { id: event.user.id } : undefined;
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs
        .map((b) => scrubBreadcrumb(b))
        .filter((b): b is Breadcrumb => b !== null);
    }
    return event;
  } catch {
    // A scrubber crash must fail CLOSED: better to drop the report than to
    // send an unscrubbed payload.
    return null as unknown as SentryErrorEvent;
  }
}

export function scrubBreadcrumb(crumb: Breadcrumb): Breadcrumb | null {
  try {
    // Console args routinely embed record content ("save failed", {…}).
    if (crumb.category === "console") return null;
    if (crumb.message) crumb.message = scrubText(crumb.message);
    if (crumb.data) {
      const data = crumb.data as Record<string, unknown>;
      if (typeof data.url === "string") data.url = scrubUrl(data.url);
      // Keep only the shape of network breadcrumbs: method, url, status.
      for (const k of Object.keys(data)) {
        if (!["url", "method", "status_code"].includes(k)) delete data[k];
      }
    }
    return crumb;
  } catch {
    return null;
  }
}
