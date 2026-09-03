// Canva flat export over the documented Connect REST API. This is the
// shipping Canva integration: paste a design link, get a PNG of page 1, and
// auto-build proposes fields from the picture the way an uploaded image
// does. There is no geometry on this path. Canva's element structure is
// only reachable through its MCP server, which is unversioned and whose
// terms restrict this use; that work is parked in canvaMcp.ts.
//
// Three endpoints, all under design:content:read, plus one design:meta:read
// call for the page count and title:
//   GET  /v1/designs/{id}                 title, page_count
//   GET  /v1/designs/{id}/export-formats  is PNG supported for page 1
//   POST /v1/exports                      start the job
//   GET  /v1/exports/{id}                 poll until success or failed
//
// Pure apart from the injected fetch and sleep, so vitest covers the job
// loop, the error mapping, and the header parsing without a network.

export const CANVA_API = "https://api.canva.com/rest/v1";

/** Poll schedule: doubles from half a second, caps at eight, and gives up
 * after a fixed wall-clock ceiling rather than a fixed attempt count, so a
 * slow export and a fast one cost the same number of requests per second. */
const FIRST_POLL_MS = 500;
const MAX_POLL_MS = 8_000;
export const POLL_CEILING_MS = 90_000;

export type CanvaExportErrorCode =
  | "license_required"
  | "approval_required"
  | "internal_failure"
  | "png_unsupported"
  | "design_not_found"
  | "design_permission_denied"
  | "throttled"
  | "timeout"
  | "http";

/** One class for everything Canva can refuse. `message` is safe to show an
 * admin; `code` and `status` are for logs. */
export class CanvaExportError extends Error {
  constructor(
    readonly code: CanvaExportErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "CanvaExportError";
  }
}

export interface ExportDeps {
  fetch: (input: string, init?: RequestInit) => Promise<Response>;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
}

export interface CanvaDesignInfo {
  title: string;
  pageCount: number;
}

export interface CanvaExportResult {
  /** Signed download URL for page 1. Fetch it immediately. */
  url: string;
  /** Milliseconds the signed URL is still valid for, read from the URL's own
   * signature parameters rather than the spec's 24 hour claim. Null when the
   * URL carries no readable expiry. */
  ttlMs: number | null;
}

// ---------------------------------------------------------------------------
// HTTP plumbing
// ---------------------------------------------------------------------------

interface CanvaErrorBody {
  code?: string;
  message?: string;
}

async function canvaJson<T>(
  deps: ExportDeps,
  token: string,
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  const res = await deps.fetch(`${CANVA_API}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  if (res.ok) return (await res.json()) as T;

  let body: CanvaErrorBody = {};
  try {
    body = (await res.json()) as CanvaErrorBody;
  } catch {
    // A non-JSON error body carries nothing worth mapping.
  }
  throw mapHttpError(res.status, body.code);
}

/** The documented error codes an admin can act on get their own sentence;
 * everything else says Canva refused and gives the status for support. */
function mapHttpError(status: number, code: string | undefined): CanvaExportError {
  if (status === 404) {
    return new CanvaExportError(
      "design_not_found",
      "Canva could not find that design. Check the link and that the connected Canva account can open it.",
      status,
    );
  }
  if (status === 403) {
    if (code === "license_required") return licenseRequired(status);
    return new CanvaExportError(
      "design_permission_denied",
      "The connected Canva account cannot open this design. Ask its owner to share it, or reconnect Canva from Settings with an account that can.",
      status,
    );
  }
  if (status === 429) {
    return new CanvaExportError(
      "throttled",
      "Canva is limiting exports right now. Wait a few minutes and try again.",
      status,
    );
  }
  return new CanvaExportError("http", `Canva refused the request (${status}).`, status);
}

const licenseRequired = (status?: number) =>
  new CanvaExportError(
    "license_required",
    "This design uses premium Canva elements that are not licensed on the connected account. License them in Canva, then try again.",
    status,
  );

// ---------------------------------------------------------------------------
// The four calls
// ---------------------------------------------------------------------------

export async function getDesignInfo(
  deps: ExportDeps,
  token: string,
  designId: string,
): Promise<CanvaDesignInfo> {
  const out = await canvaJson<{ design?: { title?: string; page_count?: number } }>(
    deps,
    token,
    `/designs/${encodeURIComponent(designId)}`,
  );
  return {
    title: typeof out.design?.title === "string" ? out.design.title : "",
    pageCount:
      typeof out.design?.page_count === "number" && out.design.page_count > 0
        ? out.design.page_count
        : 1,
  };
}

interface ExportFormats {
  formats?: { png?: { page_numbers?: number[] } };
}

/** Page 1 must support PNG. `page_numbers` is omitted when every page does. */
export async function assertPngExportable(
  deps: ExportDeps,
  token: string,
  designId: string,
): Promise<void> {
  const out = await canvaJson<ExportFormats>(
    deps,
    token,
    `/designs/${encodeURIComponent(designId)}/export-formats`,
  );
  const png = out.formats?.png;
  const ok = png !== undefined && (png.page_numbers === undefined || png.page_numbers.includes(1));
  if (!ok) {
    throw new CanvaExportError(
      "png_unsupported",
      "Canva cannot export the first page of this design as a PNG. Video, document, and website designs are not supported.",
    );
  }
}

interface ExportJob {
  job?: {
    id?: string;
    status?: "in_progress" | "success" | "failed";
    urls?: string[];
    error?: { code?: string; message?: string };
  };
}

function shapeError(what: string): CanvaExportError {
  return new CanvaExportError("http", `Canva returned an export job without ${what}.`);
}

/** Start the PNG export of page 1 and poll it to completion. Quality and
 * compression stay at Canva's defaults: `regular` never trips the premium
 * element check on its own, and lossless is the free plan's only option. */
export async function exportPagePng(
  deps: ExportDeps,
  token: string,
  designId: string,
): Promise<CanvaExportResult> {
  let job = (
    await canvaJson<ExportJob>(deps, token, "/exports", {
      method: "POST",
      body: { design_id: designId, format: { type: "png", pages: [1] } },
    })
  ).job;
  if (!job?.id || !job.status) throw shapeError("an id and status");

  const started = deps.now();
  let wait = FIRST_POLL_MS;
  while (job.status === "in_progress") {
    if (deps.now() - started > POLL_CEILING_MS) {
      throw new CanvaExportError(
        "timeout",
        "Canva is taking too long to export this design. Try again in a minute.",
      );
    }
    await deps.sleep(wait);
    wait = Math.min(wait * 2, MAX_POLL_MS);
    job = (await canvaJson<ExportJob>(deps, token, `/exports/${encodeURIComponent(job.id)}`)).job;
    if (!job?.id || !job.status) throw shapeError("an id and status");
  }

  if (job.status === "failed") throw mapJobError(job.error?.code);
  if (job.status !== "success") throw shapeError("a known status");
  const url = job.urls?.[0];
  if (typeof url !== "string" || !url) throw shapeError("a download URL");
  return { url, ttlMs: signedUrlTtlMs(url, deps.now()) };
}

function mapJobError(code: string | undefined): CanvaExportError {
  if (code === "license_required") return licenseRequired();
  if (code === "approval_required") {
    return new CanvaExportError(
      "approval_required",
      "This design needs reviewer approval in Canva before it can be exported. Get it approved, then try again.",
    );
  }
  return new CanvaExportError("internal_failure", "Canva could not export this design. Try again.");
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** How long a signed export URL is still good for, from its own query
 * string. SigV4 links carry X-Amz-Date plus X-Amz-Expires in seconds; older
 * links carry a unix Expires. The spec's flat 24 hours is not trusted. */
export function signedUrlTtlMs(url: string, now: number): number | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const date = u.searchParams.get("X-Amz-Date");
  const expires = u.searchParams.get("X-Amz-Expires");
  if (date && expires) {
    const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(date);
    const secs = Number(expires);
    if (m && Number.isFinite(secs)) {
      const issued = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
      return issued + secs * 1000 - now;
    }
  }
  const unix = u.searchParams.get("Expires");
  if (unix && /^\d+$/.test(unix)) return Number(unix) * 1000 - now;
  return null;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Width and height from the IHDR chunk, which the PNG format requires to be
 * first: signature (8) + length (4) + "IHDR" (4) + width (4) + height (4). */
export function readPngDimensions(bytes: Uint8Array): { width: number; height: number } {
  const bad = () => new CanvaExportError("http", "Canva's export was not a readable PNG.");
  if (bytes.length < 24) throw bad();
  for (let i = 0; i < PNG_SIGNATURE.length; i++) {
    if (bytes[i] !== PNG_SIGNATURE[i]) throw bad();
  }
  if (String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]) !== "IHDR") throw bad();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  if (width === 0 || height === 0) throw bad();
  return { width, height };
}
