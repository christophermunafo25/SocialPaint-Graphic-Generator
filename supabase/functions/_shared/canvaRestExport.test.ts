import { describe, expect, it } from "vitest";
import {
  CanvaExportError,
  POLL_CEILING_MS,
  assertPngExportable,
  exportPagePng,
  getDesignInfo,
  readPngDimensions,
  signedUrlTtlMs,
  type ExportDeps,
} from "./canvaRestExport.ts";

/** A scripted Connect API: each call pops the next response and records what
 * was asked. Sleep advances a fake clock instead of waiting. */
function fakeDeps(script: Array<{ status: number; body: unknown }>) {
  const calls: Array<{ url: string; method: string; body?: string }> = [];
  const sleeps: number[] = [];
  let clock = 1_000_000;
  const deps: ExportDeps = {
    fetch: (url, init) => {
      calls.push({ url, method: init?.method ?? "GET", body: init?.body as string | undefined });
      const next = script.shift();
      if (!next) throw new Error(`unscripted call: ${url}`);
      return Promise.resolve(
        new Response(JSON.stringify(next.body), {
          status: next.status,
          headers: { "Content-Type": "application/json" },
        }),
      );
    },
    sleep: (ms) => {
      sleeps.push(ms);
      clock += ms;
      return Promise.resolve();
    },
    now: () => clock,
  };
  return { deps, calls, sleeps, advance: (ms: number) => (clock += ms) };
}

const job = (status: string, extra: Record<string, unknown> = {}) => ({
  status: 200,
  body: { job: { id: "job1", status, ...extra } },
});

describe("exportPagePng", () => {
  it("starts a page 1 PNG job and returns the first URL on synchronous success", async () => {
    const { deps, calls } = fakeDeps([job("success", { urls: ["https://x/a.png"] })]);
    const out = await exportPagePng(deps, "tok", "DAAAAAAAAAA");
    expect(out.url).toBe("https://x/a.png");
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("POST");
    expect(calls[0].url).toBe("https://api.canva.com/rest/v1/exports");
    expect(JSON.parse(calls[0].body!)).toEqual({
      design_id: "DAAAAAAAAAA",
      format: { type: "png", pages: [1] },
    });
  });

  it("polls with doubling backoff capped at eight seconds", async () => {
    const { deps, calls, sleeps } = fakeDeps([
      job("in_progress"),
      job("in_progress"),
      job("in_progress"),
      job("in_progress"),
      job("in_progress"),
      job("in_progress"),
      job("success", { urls: ["https://x/a.png"] }),
    ]);
    await exportPagePng(deps, "tok", "D1");
    expect(sleeps).toEqual([500, 1000, 2000, 4000, 8000, 8000]);
    expect(calls.slice(1).every((c) => c.url.endsWith("/exports/job1"))).toBe(true);
  });

  it("gives up at the wall-clock ceiling rather than polling forever", async () => {
    const script = Array.from({ length: 100 }, () => job("in_progress"));
    const { deps, calls } = fakeDeps(script);
    await expect(exportPagePng(deps, "tok", "D1")).rejects.toMatchObject({ code: "timeout" });
    // 500+1000+2000+4000+8000 = 15.5s, then 8s a poll: well under 100 calls.
    expect(calls.length).toBeLessThan(20);
    expect(calls.length * 8000).toBeGreaterThan(POLL_CEILING_MS);
  });

  it("maps the documented job failure codes to their own messages", async () => {
    for (const [code, expected] of [
      ["license_required", /premium Canva elements/],
      ["approval_required", /reviewer approval/],
      ["internal_failure", /could not export/],
      ["something_new", /could not export/],
    ] as const) {
      const { deps } = fakeDeps([job("failed", { error: { code, message: "x" } })]);
      const run = exportPagePng(deps, "tok", "D1");
      await expect(run).rejects.toBeInstanceOf(CanvaExportError);
      await expect(run).rejects.toThrow(expected);
    }
  });

  it("refuses a job without an id, a status, or a URL", async () => {
    for (const body of [
      { job: { status: "success", urls: ["u"] } },
      { job: { id: "j" } },
      { job: { id: "j", status: "success" } },
      { job: { id: "j", status: "success", urls: [] } },
      {},
    ]) {
      const { deps } = fakeDeps([{ status: 200, body }]);
      await expect(exportPagePng(deps, "tok", "D1")).rejects.toBeInstanceOf(CanvaExportError);
    }
  });

  it("maps HTTP refusals: 404, 403 with and without license_required, 429", async () => {
    const cases: Array<[number, string | undefined, string]> = [
      [404, "design_not_found", "design_not_found"],
      [403, "design_permission_denied", "design_permission_denied"],
      [403, "license_required", "license_required"],
      [429, "user_throttle", "throttled"],
      [500, undefined, "http"],
    ];
    for (const [status, code, expected] of cases) {
      const { deps } = fakeDeps([{ status, body: { code, message: "m" } }]);
      await expect(exportPagePng(deps, "tok", "D1")).rejects.toMatchObject({
        code: expected,
        status,
      });
    }
  });

  it("sends the bearer token and never a client credential", async () => {
    const seen: Array<Record<string, string>> = [];
    const { deps } = fakeDeps([job("success", { urls: ["u"] })]);
    const spy: ExportDeps = {
      ...deps,
      fetch: (url, init) => {
        seen.push(init?.headers as Record<string, string>);
        return deps.fetch(url, init);
      },
    };
    await exportPagePng(spy, "tok", "D1");
    expect(seen[0].Authorization).toBe("Bearer tok");
    expect(Object.keys(seen[0]).some((k) => /client/i.test(k))).toBe(false);
  });
});

describe("assertPngExportable", () => {
  it("passes when png is listed for every page or for page 1", async () => {
    for (const png of [{}, { page_numbers: [1, 2] }]) {
      const { deps } = fakeDeps([{ status: 200, body: { formats: { png } } }]);
      await expect(assertPngExportable(deps, "tok", "D1")).resolves.toBeUndefined();
    }
  });
  it("fails when png is absent or page 1 is excluded", async () => {
    for (const formats of [{ pdf: {} }, { png: { page_numbers: [2] } }]) {
      const { deps } = fakeDeps([{ status: 200, body: { formats } }]);
      await expect(assertPngExportable(deps, "tok", "D1")).rejects.toMatchObject({
        code: "png_unsupported",
      });
    }
  });
});

describe("getDesignInfo", () => {
  it("reads title and page_count, defaulting a missing count to one", async () => {
    const { deps } = fakeDeps([
      { status: 200, body: { design: { title: "Poster", page_count: 3 } } },
      { status: 200, body: { design: {} } },
    ]);
    expect(await getDesignInfo(deps, "tok", "D1")).toEqual({ title: "Poster", pageCount: 3 });
    expect(await getDesignInfo(deps, "tok", "D1")).toEqual({ title: "", pageCount: 1 });
  });
});

describe("signedUrlTtlMs", () => {
  it("reads the SigV4 window from X-Amz-Date and X-Amz-Expires", () => {
    const now = Date.UTC(2026, 8, 3, 20, 0, 0);
    const url =
      "https://export-download.canva.com/a.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20260903T190000Z&X-Amz-Expires=59494&X-Amz-Signature=x";
    expect(signedUrlTtlMs(url, now)).toBe((59494 - 3600) * 1000);
  });
  it("falls back to a unix Expires and to null", () => {
    expect(signedUrlTtlMs("https://x/a.png?Expires=1000", 900_000)).toBe(100_000);
    expect(signedUrlTtlMs("https://x/a.png", 0)).toBeNull();
    expect(signedUrlTtlMs("not a url", 0)).toBeNull();
  });
});

describe("readPngDimensions", () => {
  const png = (w: number, h: number, sig = true) => {
    const b = new Uint8Array(24);
    b.set(sig ? [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] : [0, 0, 0, 0, 0, 0, 0, 0]);
    b.set([0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52], 8);
    new DataView(b.buffer).setUint32(16, w);
    new DataView(b.buffer).setUint32(20, h);
    return b;
  };
  it("reads IHDR width and height", () => {
    expect(readPngDimensions(png(1080, 1350))).toEqual({ width: 1080, height: 1350 });
  });
  it("rejects a bad signature, a short buffer, and a zero dimension", () => {
    expect(() => readPngDimensions(png(1, 1, false))).toThrow(CanvaExportError);
    expect(() => readPngDimensions(new Uint8Array(10))).toThrow(CanvaExportError);
    expect(() => readPngDimensions(png(0, 10))).toThrow(CanvaExportError);
  });
});
