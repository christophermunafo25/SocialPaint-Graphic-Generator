import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { BrandKit, FieldValues, TemplateSchema } from "@/lib/types";
import type { ChatDraft } from "@/lib/generate/chat";
import {
  busyDraftId,
  emptyQueue,
  enqueue,
  exportErrorMessage,
  instrumentsUsage,
  settle,
  type DownloadJob,
  type DownloadQueue,
} from "@/lib/generate/draftDownload";
import { ensureSchemaFontsLoaded } from "@/lib/render/fonts";
import { useBrand } from "@/lib/brand/BrandContext";
import { ErrorBoundary } from "../ErrorBoundary";
import { SchemaRenderer, type SchemaRendererHandle } from "../SchemaRenderer";

// A draft card's Download (docs/design/generate-chat/PROMPT.md §9.6): the
// draft goes through the one export path without the editor opening.
//
// Each request mounts ONE SchemaRenderer for that draft on an off-screen
// stage (BulkExportStage's technique: real canvas dimensions, positioned far
// outside the viewport, never display: none, visibility: hidden, opacity: 0
// or content-visibility, all of which rasterize blank or stale), waits for
// the commit that painted those exact values plus two animation frames,
// calls the renderer's exportPng(), and unmounts it. exportPng is the fill
// page's own delivery (a download, or the share sheet on mobile) through
// renderSchemaBlob, so a card download is the same PNG the fill page makes
// for the same template and values.
//
// Usage: SchemaRenderer records it, as everywhere. A published library draft
// renders with instrument true, so a card download records the fill page's
// `open` (the renderer mounting) and then its `download` (exportPng); a
// freestyle draft renders with instrument false and records nothing
// (instrumentsUsage).
//
// The stage is portalled to <body>, whatever the caller renders `stage`
// inside: a transformed, clipped or hidden ancestor cannot change what the
// canvas lays out, and the canvas inherits exactly what the fill page's
// does (the root's type settings), so its text measures the same.

/** One request: the draft's schema and the exact values to paint, the kit
 * it was asked for under, and whether it records usage. */
interface ExportJob extends DownloadJob {
  schema: TemplateSchema;
  values: FieldValues;
  brandKit: BrandKit | null;
  instrument: boolean;
}

export interface DraftDownload {
  /** Export `draft` painted with `values` (the caller's preview values, the
   * turn's photo in its slot) as a PNG. Resolves when that export has
   * finished, whether it downloaded, was canceled or failed; it never
   * rejects (a failure lands in `error`). A draft with no schema (its
   * template is gone) has nothing to export and resolves at once. One
   * export runs at a time: a request for another draft waits its turn, and
   * a request for a draft already exporting or waiting is that request. */
  download(draft: ChatDraft, values: FieldValues): Promise<void>;
  /** The draft exporting now, for its card's busy state. */
  busyId: string | null;
  /** The last failure's member-facing line (under TemplateFill's toast
   * title, EXPORT_ERROR_TITLE), until clearError or the next request. */
  error: string | null;
  clearError(): void;
  /** The off-screen stage. Render it anywhere inside the BrandProvider; it
   * portals itself to <body> and is null while nothing exports. */
  stage: React.ReactNode;
}

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/** Where the stage sits: real canvas dimensions, so the canvas lays out and
 * paints, but far outside the viewport, where it can never be seen,
 * clicked, or read by assistive tech. */
const stageStyle = (schema: TemplateSchema): React.CSSProperties => ({
  position: "fixed",
  left: -100000,
  top: 0,
  width: schema.canvasWidth,
  height: schema.canvasHeight,
  pointerEvents: "none",
});

/** The canvas for one request, mounted for that request alone (the hook
 * keys it on the job). It reports back exactly once, with the failure's
 * member-facing line or null. */
function ExportStage({
  job,
  onSettled,
}: {
  job: ExportJob;
  onSettled(job: ExportJob, failure: string | null): void;
}) {
  const rendererRef = useRef<SchemaRendererHandle>(null);
  // The canvas mounts once the schema's faces are loaded, so its first
  // layout pass measures the real glyphs (BulkExportStage waits on the
  // document's fonts before each row for the same reason). The export
  // itself waits for them again; this only moves the wait before layout.
  const [fontsReady, setFontsReady] = useState(false);

  useEffect(() => {
    let alive = true;
    void ensureSchemaFontsLoaded(job.schema, job.brandKit)
      .catch(() => undefined)
      .then(() => {
        if (alive) setFontsReady(true);
      });
    return () => {
      alive = false;
    };
  }, [job]);

  // Runs after the commit that mounted the renderer with job.values, which
  // is the commit of those exact values: the stage is keyed per request, so
  // there is no earlier frame to mistake for it. Then the renderer's own
  // fonts pass (it re-lays out once document.fonts settles; its callback is
  // registered first, by its own mount effect, so it lands before this
  // one's) and two frames for layout and paint. Images need no wait here:
  // renderSchemaBlob blocks on the renderer's data-image-status markers.
  useEffect(() => {
    if (!fontsReady) return;
    let alive = true;
    void (async () => {
      let failure: string | null = null;
      try {
        await document.fonts?.ready;
        await nextFrame();
        await nextFrame();
        // Unmounted while waiting (the page went away): nothing to export,
        // and a detached canvas would rasterize blank.
        if (!alive) return;
        const renderer = rendererRef.current;
        if (!renderer) throw new Error("The export canvas did not mount.");
        await renderer.exportPng();
      } catch (e) {
        console.error("Export failed", e);
        failure = exportErrorMessage(e);
      }
      if (alive) onSettled(job, failure);
    })();
    return () => {
      alive = false;
    };
  }, [fontsReady, job, onSettled]);

  if (!fontsReady) return null;
  return (
    <div aria-hidden style={stageStyle(job.schema)}>
      {/* A template that cannot render must not take the chat down with it;
          the missing renderer then fails the export with the generic line. */}
      <ErrorBoundary level="canvas" context={{ templateId: job.schema.id }} fallback={() => null}>
        <SchemaRenderer
          ref={rendererRef}
          schema={job.schema}
          values={job.values}
          brandKit={job.brandKit}
          instrument={job.instrument}
        />
      </ErrorBoundary>
    </div>
  );
}

/** Direct card downloads for the Generate chat (see the file header). The
 * caller renders `stage` and wires each card's Download to `download` and
 * its busy state to `busyId`. Must be used inside the BrandProvider: the
 * export paints with the active brand kit, like the card's thumbnail. */
export function useDraftDownload(): DraftDownload {
  const { kit } = useBrand();
  const [queue, setQueue] = useState<DownloadQueue<ExportJob>>(emptyQueue);
  const [error, setError] = useState<string | null>(null);
  const lastJobId = useRef(0);
  /** Every request not yet finished, by draft: what its caller awaits. The
   * source of truth for "already asked for", read synchronously, so two
   * clicks in one frame are one request. */
  const requests = useRef(new Map<string, { promise: Promise<void>; resolve(): void }>());

  const download = useCallback(
    (draft: ChatDraft, values: FieldValues): Promise<void> => {
      const schema = draft.schema;
      if (!schema) return Promise.resolve();
      const live = requests.current.get(draft.id);
      if (live) return live.promise;
      let resolve!: () => void;
      const promise = new Promise<void>((r) => {
        resolve = r;
      });
      requests.current.set(draft.id, { promise, resolve });
      const job: ExportJob = {
        id: ++lastJobId.current,
        draftId: draft.id,
        schema,
        values,
        brandKit: kit,
        instrument: instrumentsUsage(draft),
      };
      // A new request is a new attempt: the last failure's line goes.
      setError(null);
      setQueue((q) => enqueue(q, job));
      return promise;
    },
    [kit],
  );

  const onSettled = useCallback((job: ExportJob, failure: string | null) => {
    if (failure !== null) setError(failure);
    requests.current.get(job.draftId)?.resolve();
    requests.current.delete(job.draftId);
    setQueue((q) => settle(q, job.id));
  }, []);

  const clearError = useCallback(() => setError(null), []);

  // Nobody waits forever on a page that has gone: whatever was still
  // exporting or waiting resolves when the caller unmounts.
  useEffect(() => {
    const live = requests.current;
    return () => {
      for (const request of live.values()) request.resolve();
      live.clear();
    };
  }, []);

  const active = queue.active;
  const stage = active
    ? createPortal(
        <ExportStage key={active.id} job={active} onSettled={onSettled} />,
        document.body,
      )
    : null;

  return { download, busyId: busyDraftId(queue), error, clearError, stage };
}
