import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { BrandKit, FieldValues, TemplateSchema } from "@/lib/types";
import { SchemaRenderer, type SchemaRendererHandle } from "../SchemaRenderer";

// The off-screen canvas a bulk run renders on: one SchemaRenderer, mounted
// once for the whole run, whose only per-row change is the `values` prop.
//
// The two ways a naive version goes wrong, and what this does about each:
//
//  - Remounting per row. The renderer resolves the background to a data URL
//    on mount; remounting refetches it for every row. So there is one
//    mounted renderer and renderRow only swaps its values.
//  - Rasterizing a stale frame. Setting state does not mean the pixels have
//    changed. renderRow resolves its settle promise from an effect that runs
//    after React commits THAT values object, then waits two animation
//    frames for layout and paint, and only then rasterizes. A fixed timeout
//    would be a guess about how long a commit takes; the effect is the
//    commit. Image readiness is not waited for here because renderSchemaBlob
//    already blocks on the renderer's data-image-status markers.
//
// It is positioned far outside the viewport with real dimensions rather
// than hidden: a node the browser does not lay out rasterizes as blank or
// as the previous frame, so display: none, visibility: hidden, opacity: 0
// and content-visibility are all wrong here.

export interface BulkExportStageHandle {
  renderRow(values: FieldValues): Promise<Blob>;
}

interface PendingRow {
  values: FieldValues;
  resolve(): void;
  reject(reason: Error): void;
}

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

export const BulkExportStage = forwardRef<
  BulkExportStageHandle,
  { schema: TemplateSchema; brandKit: BrandKit | null }
>(function BulkExportStage({ schema, brandKit }, ref) {
  const rendererRef = useRef<SchemaRendererHandle>(null);
  const [values, setValues] = useState<FieldValues>({});
  const pendingRef = useRef<PendingRow | null>(null);

  // Runs after the commit for `values`. If it is the object a renderRow
  // call is waiting on, that call may proceed — but not before the browser
  // has had two frames to lay out and paint the new text.
  useEffect(() => {
    const pending = pendingRef.current;
    if (!pending || pending.values !== values) return;
    pendingRef.current = null;
    let cancelled = false;
    void nextFrame()
      .then(nextFrame)
      .then(() => {
        if (cancelled) pending.reject(new Error("The export stage was closed."));
        else pending.resolve();
      });
    return () => {
      cancelled = true;
    };
  }, [values]);

  // A row still waiting when the stage unmounts must not hang forever.
  useEffect(
    () => () => {
      pendingRef.current?.reject(new Error("The export stage was closed."));
      pendingRef.current = null;
    },
    [],
  );

  const renderRow = useCallback(async (row: FieldValues): Promise<Blob> => {
    if (pendingRef.current) {
      throw new Error("The stage renders one row at a time.");
    }
    // Rows must all measure with the same glyphs. Waiting for the
    // document's fonts once per row (a no-op after the first) means row 1
    // is never laid out with fallback metrics that row 2 then corrects.
    await document.fonts?.ready;
    // A fresh object every time, so the effect above can tell this
    // commit apart from the previous row even when the values are equal.
    const next: FieldValues = { ...row };
    await new Promise<void>((resolve, reject) => {
      pendingRef.current = { values: next, resolve, reject };
      setValues(next);
    });
    const renderer = rendererRef.current;
    if (!renderer) throw new Error("Canvas not mounted");
    return renderer.renderBlob();
  }, []);

  useImperativeHandle(ref, () => ({ renderRow }), [renderRow]);

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        left: -100000,
        top: 0,
        width: schema.canvasWidth,
        height: schema.canvasHeight,
        pointerEvents: "none",
      }}
    >
      <SchemaRenderer
        ref={rendererRef}
        schema={schema}
        values={values}
        brandKit={brandKit}
        instrument={false}
      />
    </div>
  );
});
