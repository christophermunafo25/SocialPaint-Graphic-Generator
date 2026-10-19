import React, { useEffect, useRef, useState } from "react";
import { SchemaRenderer, type SchemaRendererHandle } from "../components/SchemaRenderer";
import { ensureSchemaFontsLoaded, registerCustomFont } from "@/lib/render/fonts";
import type { BrandKit } from "@/lib/types";
import {
  STARTER_PREFIX,
  fixtureFontAsset,
  fixtureFontUrl,
  resolveFileFixture,
  resolveStarterFixture,
  type FidelityFixture,
  type ResolvedFixture,
  type StarterWorkspace,
} from "./fidelity";

/** What `window.__spFidelity.ready` resolves with. */
export interface FidelityReady {
  fixture: string;
  width: number;
  height: number;
  /** Fixture fonts whose file isn't there (a private font not installed).
   * The runner reports the fixture as skipped, never as passed. */
  missingFonts: string[];
}

declare global {
  interface Window {
    /** The fidelity harness's handle on this page (scripts/fidelity). */
    __spFidelity?: {
      ready: Promise<FidelityReady>;
      /** The export path's PNG (renderSchemaBlob), base64 without a prefix. */
      render(): Promise<string>;
    };
  }
}

/** Every fixture file, loaded on demand. The glob lives in this dev-only
 * chunk, so a production build contains no fixture. */
const FIXTURE_FILES = import.meta.glob<FidelityFixture>("/test/fidelity/fixtures/*/fixture.json", {
  import: "default",
});

const IMAGE_TIMEOUT_MS = 15000;
const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

async function loadWorkspace(): Promise<StarterWorkspace> {
  const mod = await import("../../../scripts/new-look/fixtures/dev-workspace.json");
  const db = mod.default.localStorage["brand-portal-dev-db"];
  const company = db.companies[0];
  return {
    company: { id: company.id, name: company.name },
    kit: db.brandKits[0] as unknown as BrandKit,
  };
}

async function resolveFixture(name: string, variant?: string): Promise<ResolvedFixture> {
  if (name.startsWith(STARTER_PREFIX)) {
    const resolved = resolveStarterFixture(name, variant, await loadWorkspace());
    if (!resolved) throw new Error(`No starter blueprint for ${name}`);
    return resolved;
  }
  const load = FIXTURE_FILES[`/test/fidelity/fixtures/${name}/fixture.json`];
  if (!load) throw new Error(`No fixture named ${name}`);
  const resolved = resolveFileFixture(await load(), variant);
  if (!resolved) throw new Error(`Fixture ${name} has no schema`);
  return resolved;
}

/** Registers each fixture font that exists and names the ones that don't. */
async function registerFixtureFonts(name: string, fixture: ResolvedFixture): Promise<string[]> {
  const missing: string[] = [];
  for (const font of fixture.fonts) {
    const url = fixtureFontUrl(name, font);
    const res = await fetch(url, { method: "HEAD" }).catch(() => null);
    // Vite answers an unknown path with index.html, so a font is only
    // there when the response is not HTML.
    const type = res?.headers.get("content-type") ?? "";
    if (!res?.ok || type.includes("text/html")) {
      missing.push(url);
      continue;
    }
    await registerCustomFont(fixtureFontAsset(name, font));
  }
  return missing;
}

async function imagesSettled(root: HTMLElement): Promise<void> {
  const deadline = Date.now() + IMAGE_TIMEOUT_MS;
  while (root.querySelector('[data-image-status="loading"]')) {
    if (Date.now() > deadline) throw new Error("Timed out waiting for images");
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ""));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

/** /dev/render/:fixture?variant= — one fidelity fixture on a bare page at
 * scale 1, for scripts/fidelity/fidelity.mjs. No app chrome, no usage
 * events. Development builds only: the router never returns this route
 * when import.meta.env.DEV is false. */
export function DevRenderPage({ fixture, variant }: { fixture: string; variant?: string }) {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ready"; resolved: ResolvedFixture; missingFonts: string[] }
  >({ status: "loading" });
  const handle = useRef<SchemaRendererHandle>(null);
  const frame = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const resolved = await resolveFixture(fixture, variant);
        const missingFonts = await registerFixtureFonts(fixture, resolved);
        if (live) setState({ status: "ready", resolved, missingFonts });
      } catch (e) {
        if (live)
          setState({ status: "error", message: e instanceof Error ? e.message : String(e) });
      }
    })();
    return () => {
      live = false;
    };
  }, [fixture, variant]);

  useEffect(() => {
    if (state.status === "error") {
      const failed = Promise.reject(new Error(state.message));
      failed.catch(() => undefined);
      window.__spFidelity = {
        ready: failed,
        render: () => Promise.reject(new Error(state.message)),
      };
      return;
    }
    if (state.status !== "ready") return;
    const { schema, brandKit } = state.resolved;
    const ready = (async (): Promise<FidelityReady> => {
      await ensureSchemaFontsLoaded(schema, brandKit);
      await document.fonts.ready;
      if (frame.current) await imagesSettled(frame.current);
      await nextFrame();
      await nextFrame();
      return {
        fixture,
        width: schema.canvasWidth,
        height: schema.canvasHeight,
        missingFonts: state.missingFonts,
      };
    })();
    ready.catch(() => undefined);
    window.__spFidelity = {
      ready,
      render: async () => {
        await ready;
        if (!handle.current) throw new Error("Renderer not mounted");
        return blobToBase64(await handle.current.renderBlob());
      },
    };
    return () => {
      delete window.__spFidelity;
    };
  }, [state, fixture]);

  useEffect(() => {
    const body = document.body.style;
    const previous = body.margin;
    body.margin = "0";
    return () => {
      body.margin = previous;
    };
  }, []);

  if (state.status === "error") {
    return <p data-fidelity-error>{state.message}</p>;
  }
  if (state.status === "loading") return null;
  const { schema, values, brandKit, variantId, emptyFields } = state.resolved;
  return (
    <div
      ref={frame}
      data-fidelity-frame={fixture}
      style={{ width: schema.canvasWidth, height: schema.canvasHeight }}
    >
      <SchemaRenderer
        ref={handle}
        schema={schema}
        values={values}
        brandKit={brandKit}
        instrument={false}
        variantId={variantId}
        emptyFields={emptyFields}
      />
    </div>
  );
}
