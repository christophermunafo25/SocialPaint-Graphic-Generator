import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import type { BrandKit, LayoutGroup, TemplateField } from "@/lib/types";
import { groupChildRef, isFreeGroup, parseGroupChildRef } from "@/lib/types";
import { useDataUrl } from "@/lib/render/useDataUrl";
import { useBrand } from "@/lib/brand/BrandContext";
import { fieldsFontUsage, loadGoogleFonts } from "@/lib/render/fonts";
import { fitText } from "@/lib/render/autoFit";
import {
  groupFieldKeys,
  outermostGroupOf,
  parentGroupOf,
  type LayoutResult,
  type Rect,
} from "@/lib/render/layout";
import { resolveFieldStyle } from "@/lib/brand/resolveStyle";
import { cornerRadiusCss, DEFAULT_FILL_HEX, FieldBoxContent } from "../SchemaRenderer";
import { ErrorBoundary, FieldCrashFallback } from "../ErrorBoundary";
import { PALETTE_MIME, isTypingTarget, paintOrder } from "./fieldOps";
import { selectedGroupIds } from "./groupOps";
import { cancelActiveGesture, startDrag } from "./canvasGesture";

interface FieldOverlayEditorProps {
  canvasWidth: number;
  canvasHeight: number;
  backgroundUrl: string;
  /** Canvas base fill (schemaBackgroundCss) — under the background image. */
  backgroundCss?: string;
  fields: TemplateField[];
  /** Groups over the fields — plain or auto-layout (may be empty). */
  groups: LayoutGroup[];
  /** The builder's layout pass over the current draft: computed rects for
   * grouped children, group frames, and shrink-adjusted font sizes. */
  layout: LayoutResult;
  /** Preview values painted instead of placeholders (the inspector's
   * worst-case preview). Must be the same values the layout pass ran on. */
  values?: import("@/lib/types").FieldValues;
  /** A just-created group: its frame flashes so the admin sees what the
   * grouping actually produced. */
  flashGroupId?: string | null;
  /** Groups currently outgrowing the canvas — their frames flag it. */
  overflowGroupIds: string[];
  /** Selection entries are field ids or "group:<id>" refs. */
  selectedIds: string[];
  onSelect(ids: string[]): void;
  onChange(fields: TemplateField[]): void;
  /** Commit a move of the whole selection — loose fields at their new
   * geometry, plus a delta for every selected group (the builder decides
   * what that delta writes to: a stack's anchor, or a plain group's
   * children). ONE call, so a mixed selection is one undo entry. */
  onMoveSelection(move: {
    fields: Array<{ id: string } & Partial<TemplateField>>;
    groupIds: string[];
    dx: number;
    dy: number;
  }): void;
  /** Commit a stack-order change from a child drag. */
  onReorderChildren(id: string, children: string[]): void;
  /** Secondary path: the admin drew a raw box (canvas-space rect). */
  onDraw(rect: { x: number; y: number; width: number; height: number }): void;
  /** Primary path: a palette element was dropped at a canvas point. */
  onDropElement(paletteId: string, at: { x: number; y: number }): void;
  /** Image files dragged from disk (or another app) onto the canvas. */
  onDropFiles(files: File[], at: { x: number; y: number }): void;
  /** Right-click on a field (id), a group frame ("group:<id>"), or empty
   * canvas (null, with canvas point). */
  onContextMenu(
    pos: { x: number; y: number },
    fieldId: string | null,
    canvasPoint: { x: number; y: number },
  ): void;
  /** Double-click on a member-editable element: the text an admin can change
   * there is its NAME, which lives in the inspector — focus it. */
  onRequestLabelFocus(fieldId: string): void;
}

interface DrawState {
  startX: number;
  startY: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Live geometry while a gesture is in progress. The draft (and therefore
 * history and autosave) is untouched until the gesture ends: overrides hold
 * the per-frame truth, one state write per frame, and the commit on release
 * writes exactly what was last rendered — mid-drag IS what you get. */
interface GestureFrame {
  kind: "move" | "resize" | "rotate" | "groupMove" | "reorder";
  overrides: Map<string, Partial<TemplateField>>;
  guides: Guide[];
  /** groupMove: every listed group frame and member field translates live. */
  groupDelta?: { groupIds: Set<string>; fieldIds: Set<string>; dx: number; dy: number };
  /** reorder: the dragged child's main-axis offset (vertical: dy). */
  reorderDelta?: { fieldId: string; dx: number; dy: number };
}

interface Guide {
  axis: "v" | "h";
  /** Canvas-space position of the line. */
  pos: number;
}

/** Smallest committable box edge, canvas px. Applied live during the drag
 * (computed from the start rect, so the cursor picks the edge back up on the
 * way out — no jump at release). */
const MIN_SIZE = 16;
/** Snap capture distance in screen px (converted per-frame to canvas px). */
const SNAP_SCREEN_PX = 6;
/** Movement below this many screen px is a click, not a drag. */
const DRAG_THRESHOLD_PX = 3;
/** A move can bleed past the canvas edge, but this much of the selection
 * must stay inside — an element can never be dragged fully out of reach.
 * Clamped live during the drag, so what shows is what commits. */
const MIN_VISIBLE = 24;
/** Below this box size on screen (px), the mid-edge handles crowd the
 * corners and the body — only the corner handles render. */
const HANDLE_CROWD_PX = 28;

/** Zoom multiplies the fit scale, so 1 is always "the whole canvas". Zooming
 * out past fit would only add empty space, hence the floor at 1. */
const MIN_ZOOM = 1;
const MAX_ZOOM = 8;
const ZOOM_STEP = 1.25;

/** Invisible resize strips along each border: the whole edge is grabbable,
 * Figma-style, whatever size the box is — the visible dots are wayfinding,
 * not the hit target. Inset from the ends so the corner dots win corners. */
const EDGE_STRIPS: Array<{
  dx: -1 | 0 | 1;
  dy: -1 | 0 | 1;
  cursor: string;
  style: React.CSSProperties;
}> = [
  { dx: 0, dy: -1, cursor: "ns-resize", style: { left: 8, right: 8, top: -5, height: 10 } },
  { dx: 0, dy: 1, cursor: "ns-resize", style: { left: 8, right: 8, bottom: -5, height: 10 } },
  { dx: -1, dy: 0, cursor: "ew-resize", style: { top: 8, bottom: 8, left: -5, width: 10 } },
  { dx: 1, dy: 0, cursor: "ew-resize", style: { top: 8, bottom: 8, right: -5, width: 10 } },
];

const RESIZE_DIRS: Array<{ dx: -1 | 0 | 1; dy: -1 | 0 | 1; cursor: string }> = [
  { dx: -1, dy: -1, cursor: "nwse-resize" },
  { dx: 0, dy: -1, cursor: "ns-resize" },
  { dx: 1, dy: -1, cursor: "nesw-resize" },
  { dx: 1, dy: 0, cursor: "ew-resize" },
  { dx: 1, dy: 1, cursor: "nwse-resize" },
  { dx: 0, dy: 1, cursor: "ns-resize" },
  { dx: -1, dy: 1, cursor: "nesw-resize" },
  { dx: -1, dy: 0, cursor: "ew-resize" },
];

/** Editor always works in top-left space; center-anchored fields are
 * normalized on display and denormalized on commit. */
const displayX = (f: TemplateField): number => (f.anchor === "center" ? f.x - f.width / 2 : f.x);
const displayY = (f: TemplateField): number => (f.anchor === "center" ? f.y - f.height / 2 : f.y);
const toAnchorSpace = (
  f: TemplateField,
  tlx: number,
  tly: number,
  w = f.width,
  h = f.height,
): { x: number; y: number } => ({
  x: f.anchor === "center" ? tlx + w / 2 : tlx,
  y: f.anchor === "center" ? tly + h / 2 : tly,
});

/** Whether a canvas-space point falls inside a display rect, rotation
 * included: transform the point into the box's local axes and compare. */
function hitTestRect(
  r: { x: number; y: number; width: number; height: number },
  rotation: number | undefined,
  p: { x: number; y: number },
): boolean {
  const cx = r.x + r.width / 2;
  const cy = r.y + r.height / 2;
  const rad = ((rotation ?? 0) * Math.PI) / 180;
  const dx0 = p.x - cx;
  const dy0 = p.y - cy;
  const dx = Math.cos(rad) * dx0 + Math.sin(rad) * dy0;
  const dy = -Math.sin(rad) * dx0 + Math.cos(rad) * dy0;
  return Math.abs(dx) <= r.width / 2 && Math.abs(dy) <= r.height / 2;
}

/** Snap one axis of a moving span: try its start / center / end against the
 * targets, take the closest hit inside the threshold, and report the line. */
function snapAxis(
  lo: number,
  hi: number,
  targets: number[],
  thresh: number,
): { adjust: number; guide: number | null } {
  const cands = [lo, (lo + hi) / 2, hi];
  let best = Infinity;
  let adjust = 0;
  let guide: number | null = null;
  for (const t of targets) {
    for (const c of cands) {
      const d = t - c;
      if (Math.abs(d) < Math.abs(best)) {
        best = d;
        adjust = d;
        guide = t;
      }
    }
  }
  if (Math.abs(best) > thresh) return { adjust: 0, guide: null };
  return { adjust, guide };
}

/** Memoized so only fields whose geometry is actually changing re-render
 * their content per frame (text measurement isn't free). */
const FieldContent = React.memo(FieldBoxContent);

/** In-place editing for a FIXED text element's content (double-click to
 * enter). A contentEditable mirror of TextFieldBox's own <p> — same resolved
 * face, size fitting, alignment, spacing — so entering and leaving edit mode
 * moves nothing. Commits ONCE on exit (blur or Enter): one undo entry per
 * editing session. Escape reverts and exits. */
function InlineTextEditor({
  field,
  brandKit,
  scale,
  onCommit,
  onExit,
}: {
  field: TemplateField;
  brandKit: BrandKit | null;
  scale: number;
  onCommit(text: string): void;
  onExit(): void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const original = field.staticValue ?? "";
  /** Mirrors the DOM text purely so font fitting recomputes per keystroke —
   * the contentEditable itself stays uncontrolled. */
  const [text, setText] = useState(original);
  const cancelled = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, []);

  const style = resolveFieldStyle(field, brandKit);
  const singleLine = field.type !== "multiline";
  const shown = text || " ";
  const fontSize = fitText(
    { ...style, multiline: !singleLine, width: field.width, height: field.height },
    shown,
  ).fontSizePx;
  const brandHex = style.colorKey
    ? brandKit?.colors.find((c) => c.key === style.colorKey)?.hex
    : undefined;
  const color = brandHex ?? style.colorHex ?? DEFAULT_FILL_HEX;
  const justify =
    field.align === "center" ? "center" : field.align === "right" ? "flex-end" : "flex-start";
  const alignItems =
    field.verticalAlign === "top"
      ? "flex-start"
      : field.verticalAlign === "bottom"
        ? "flex-end"
        : "center";

  const finish = (commit: boolean) => {
    if (cancelled.current) return;
    cancelled.current = true;
    if (commit) {
      const next = ref.current?.innerText ?? text;
      if (next !== original) onCommit(next);
    }
    onExit();
  };

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <div
        style={{
          width: field.width,
          height: field.height,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          display: "flex",
          alignItems,
          justifyContent: justify,
        }}
      >
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-label={`Edit ${field.label} content`}
          onPointerDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          onInput={(e) => setText((e.target as HTMLElement).innerText)}
          onKeyDown={(e) => {
            // Every key belongs to the editor — the builder's shortcuts
            // (Delete, ⌘Z, Escape-deselect) must not fire while typing.
            e.stopPropagation();
            if (e.key === "Escape") {
              e.preventDefault();
              finish(false);
            } else if (e.key === "Enter" && singleLine) {
              e.preventDefault();
              finish(true);
            }
          }}
          onBlur={() => finish(true)}
          style={{
            fontFamily: style.fontFamily ? `"${style.fontFamily}", sans-serif` : "sans-serif",
            fontWeight: style.fontWeight,
            fontStyle: style.fontStyle,
            fontStretch: style.fontStretch,
            fontSize,
            color,
            textAlign: field.align ?? "left",
            textTransform: style.uppercase ? "uppercase" : undefined,
            letterSpacing: style.letterSpacingPx ? `${style.letterSpacingPx}px` : undefined,
            lineHeight: style.lineHeight ?? 1.1,
            whiteSpace: singleLine ? "nowrap" : "pre-wrap",
            wordBreak: singleLine ? undefined : "break-word",
            width: singleLine ? undefined : "100%",
            minWidth: 20,
            margin: 0,
            outline: "none",
            caretColor: "var(--editor-accent)",
            cursor: "text",
          }}
        >
          {original}
        </div>
      </div>
    </div>
  );
}

/** The Template Builder's design canvas. Every drag — move, the 8 resize
 * handles, rotate, draw-to-create — runs through the shared canvasGesture
 * core: pointer capture, rAF-throttled frames, a click/drag threshold, and
 * clean cancel on Escape/blur/unmount. Geometry writes are REAL per frame
 * (no transform preview): what shows mid-drag is what commits on release,
 * as one undo entry. Smart guides snap to canvas edges/centers and to other
 * elements; ⌘/Ctrl suppresses snapping. Multi-select via shift/⌘-click with
 * group drag. Palette elements drop where released; drawing a box still
 * works as a secondary path. All coordinates commit in canvas pixel space. */
export function FieldOverlayEditor(props: FieldOverlayEditorProps) {
  const {
    canvasWidth,
    canvasHeight,
    backgroundUrl,
    backgroundCss,
    fields,
    groups,
    layout,
    values,
    overflowGroupIds,
    flashGroupId,
    selectedIds,
    onSelect,
    onChange,
    onMoveSelection,
    onReorderChildren,
    onDraw,
    onDropElement,
    onDropFiles,
    onContextMenu,
    onRequestLabelFocus,
  } = props;
  const { kit } = useBrand();
  /** The SCALED SURFACE — every pointer-to-canvas conversion measures against
   * this element, so panning is free: the browser scrolls it and its
   * bounding rect already reflects the offset. */
  const containerRef = useRef<HTMLDivElement>(null);
  /** The scrolling window the surface sits in. */
  const viewportRef = useRef<HTMLDivElement>(null);
  /** Scale at which the whole canvas fits the viewport — zoom 1. */
  const [fitScale, setFitScale] = useState(0.4);
  const [zoom, setZoom] = useState(1);
  const scale = fitScale * zoom;
  const [draw, setDraw] = useState<DrawState | null>(null);
  /** Outlines and chips follow the pointer — twelve fields ≠ twelve chips. */
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null);
  const [frame, setFrame] = useState<GestureFrame | null>(null);
  /** Fixed text element whose content is being edited in place. */
  const [editingId, setEditingId] = useState<string | null>(null);
  const background = useDataUrl(backgroundUrl || undefined);
  const backgroundDataUrl = background.dataUrl;

  // Gesture callbacks fire outside the render cycle; refs keep them reading
  // the current props/scale instead of the closure they were created in.
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onMoveSelectionRef = useRef(onMoveSelection);
  onMoveSelectionRef.current = onMoveSelection;
  const onReorderChildrenRef = useRef(onReorderChildren);
  onReorderChildrenRef.current = onReorderChildren;
  // Owned by applyZoom (which advances it eagerly), so it is NOT re-synced
  // from the render's `zoom` the way the other mirrors below are.
  const zoomRef = useRef(zoom);
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const groupsRef = useRef(groups);
  groupsRef.current = groups;
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  // --- Group lookups -------------------------------------------------------

  /** fieldKey → the group DIRECTLY containing it. */
  const directGroupOf = (fieldKey: string): LayoutGroup | undefined =>
    groupsRef.current.find((g) => g.children.includes(fieldKey));

  const isGrouped = (f: TemplateField): boolean => Boolean(directGroupOf(f.fieldKey));

  /** Whether a STACK owns this field's position. Children of plain groups
   * keep their own — they move and resize like ungrouped fields. */
  const inStack = (f: TemplateField): boolean => {
    const g = directGroupOf(f.fieldKey);
    return Boolean(g && !isFreeGroup(g));
  };

  /** Is `descendantId` anywhere inside the group `ancestorId`? */
  const contains = (ancestorId: string, descendantId: string): boolean => {
    const seen = new Set<string>();
    const walk = (id: string): boolean => {
      if (id === descendantId) return true;
      if (seen.has(id)) return false;
      seen.add(id);
      const g = groupsRef.current.find((x) => x.id === id);
      if (!g) return false;
      return g.children.some((ref) => {
        const nested = parseGroupChildRef(ref);
        return nested ? walk(nested) : false;
      });
    };
    return groupsRef.current.some((g) => g.id === ancestorId) && walk(ancestorId);
  };

  /** A field's DISPLAY rect in canvas space: the layout pass's output for
   * grouped children, the authored box otherwise. Everything the overlay
   * paints, hits, or snaps against reads through here — one positioning
   * path, same as the renderer. */
  const displayRect = (f: TemplateField): Rect => {
    const r = layoutRef.current.fieldRects.get(f.id);
    return r ?? { x: displayX(f), y: displayY(f), width: f.width, height: f.height };
  };

  // A mode switch or navigation mid-drag must not strand the capture.
  useEffect(() => () => cancelActiveGesture(), []);

  // Editing lives and dies with the selection: selecting anything else (or
  // deleting the field) closes the editor.
  useEffect(() => {
    if (editingId && (selectedIds.length !== 1 || selectedIds[0] !== editingId)) {
      setEditingId(null);
    }
  }, [editingId, selectedIds]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    // clientWidth, not offsetWidth: once zoomed in the viewport carries a
    // scrollbar, and fit must be measured against the space actually left.
    const update = () => {
      // A zero width (hidden ancestor, first paint) would make scale 0 and
      // poison every pointer-to-canvas conversion with Infinity/NaN.
      if (el.clientWidth <= 0) return;
      setFitScale(Math.max(0.01, Math.min(el.clientWidth / canvasWidth, 1)));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [canvasWidth]);

  /** The canvas point to pin, and where in the viewport to pin it, captured
   * before a zoom and applied after the surface has resized. */
  const zoomAnchorRef = useRef<{ canvasX: number; canvasY: number; ax: number; ay: number } | null>(
    null,
  );

  /** Zoom to `next`, holding a point still: whatever sits under the cursor
   * (or the middle of the view, for the buttons and shortcuts) stays put. */
  const applyZoom = useCallback((next: number, anchor?: { clientX: number; clientY: number }) => {
    const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, next));
    if (clamped === zoomRef.current) return;
    const vp = viewportRef.current;
    const surface = containerRef.current;
    // Advance the ref NOW, not at the next render: repeated clicks and wheel
    // ticks arrive faster than React re-renders, and each must step off the
    // last rather than all recomputing from the same stale zoom.
    zoomRef.current = clamped;
    setZoom(clamped);
    if (!vp || !surface) return;
    // Only the FIRST pin of a batch is measured against un-stale geometry,
    // and it stays valid: "hold canvas point P at viewport position A" is
    // true whatever the intermediate steps were.
    if (zoomAnchorRef.current) return;
    const vpRect = vp.getBoundingClientRect();
    const surfRect = surface.getBoundingClientRect();
    const before = scaleRef.current;
    const ax = (anchor?.clientX ?? vpRect.left + vp.clientWidth / 2) - vpRect.left;
    const ay = (anchor?.clientY ?? vpRect.top + vp.clientHeight / 2) - vpRect.top;
    zoomAnchorRef.current = {
      canvasX: (vpRect.left + ax - surfRect.left) / before,
      canvasY: (vpRect.top + ay - surfRect.top) / before,
      ax,
      ay,
    };
  }, []);

  // Re-scroll to the pinned point in the same frame the resized surface is
  // committed — a layout effect, so the canvas never visibly jumps.
  useLayoutEffect(() => {
    const pin = zoomAnchorRef.current;
    const vp = viewportRef.current;
    zoomAnchorRef.current = null;
    if (!pin || !vp) return;
    vp.scrollLeft = pin.canvasX * scale - pin.ax;
    vp.scrollTop = pin.canvasY * scale - pin.ay;
  }, [scale]);

  // ⌘0 fits, ⌘+/⌘- step. Preventing the default takes the browser's own page
  // zoom out of the way while the builder canvas has focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      if (isTypingTarget(e)) return;
      if (e.key === "0") {
        e.preventDefault();
        applyZoom(1);
      } else if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        applyZoom(zoomRef.current * ZOOM_STEP);
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        applyZoom(zoomRef.current / ZOOM_STEP);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [applyZoom]);

  // Trackpad pinch and ctrl+wheel zoom about the pointer. Registered
  // natively because React's onWheel is passive — it cannot preventDefault.
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return; // plain wheel scrolls, as it should
      e.preventDefault();
      applyZoom(zoomRef.current * Math.exp(-e.deltaY / 240), e);
    };
    vp.addEventListener("wheel", onWheel, { passive: false });
    return () => vp.removeEventListener("wheel", onWheel);
  }, [applyZoom]);

  // The edit canvas shows real field content (name/placeholder in the real
  // styling), so the designed typefaces must load here too, not just in
  // preview mode.
  useEffect(() => {
    loadGoogleFonts(fieldsFontUsage(fields, kit));
  }, [fields, kit]);

  const toCanvas = useCallback(
    (e: { clientX: number; clientY: number }) => {
      const rect = containerRef.current!.getBoundingClientRect();
      const s = scaleRef.current;
      return {
        x: Math.max(0, Math.min(canvasWidth, (e.clientX - rect.left) / s)),
        y: Math.max(0, Math.min(canvasHeight, (e.clientY - rect.top) / s)),
      };
    },
    [canvasWidth, canvasHeight],
  );

  /** Unclamped variant — rotation needs true angles past the canvas edge. */
  const toCanvasFree = (e: { clientX: number; clientY: number }) => {
    const rect = containerRef.current!.getBoundingClientRect();
    const s = scaleRef.current;
    return { x: (e.clientX - rect.left) / s, y: (e.clientY - rect.top) / s };
  };

  /** Snap targets from every field NOT being dragged, plus the canvas
   * edges and centers. Canvas-space DISPLAY rects (grouped children snap at
   * their computed positions), computed once per gesture. */
  const snapTargets = (excluded: Set<string>) => {
    const v = [0, canvasWidth / 2, canvasWidth];
    const h = [0, canvasHeight / 2, canvasHeight];
    for (const f of fieldsRef.current) {
      if (excluded.has(f.id)) continue;
      const r = displayRect(f);
      v.push(r.x, r.x + r.width / 2, r.x + r.width);
      h.push(r.y, r.y + r.height / 2, r.y + r.height);
    }
    return { v, h };
  };

  /** One commit per gesture = one undo entry. Geometry rounds to whole
   * canvas px here and only here — frames stay fractional so slow drags
   * don't stair-step. */
  const commitOverrides = (
    overrides: Map<string, Partial<TemplateField>>,
    extra?: Map<string, Partial<TemplateField>>,
  ) => {
    const next = fieldsRef.current.map((f) => {
      const o = overrides.get(f.id);
      if (!o) return f;
      const merged: TemplateField = { ...f, ...o, ...extra?.get(f.id) };
      merged.x = Math.round(merged.x);
      merged.y = Math.round(merged.y);
      merged.width = Math.round(merged.width);
      merged.height = Math.round(merged.height);
      if (merged.rotation !== undefined) {
        const deg = Math.round(merged.rotation) % 360;
        merged.rotation = deg === 0 ? undefined : deg;
      }
      return merged;
    });
    onChangeRef.current(next);
  };

  // --- Move (single or group) ----------------------------------------------

  const beginMove = (
    e: React.PointerEvent,
    ids: string[],
    primaryId: string,
    reduceOnTap: boolean,
  ) => {
    // Stack children have COMPUTED positions — a free move can't apply.
    // They drop out of the drag set (their stack travels as a group instead).
    // Plain-group children keep authored positions and move like any field.
    const dragSet = new Set(
      ids.filter((id) => {
        const f = fieldsRef.current.find((x) => x.id === id);
        return f && !inStack(f);
      }),
    );
    const startRects = fieldsRef.current
      .filter((f) => dragSet.has(f.id))
      .map((f) => ({ f, tlx: displayX(f), tly: displayY(f) }));

    // Selected groups travel with the selection. Only TOP-LEVEL ones move
    // under their own steam — a nested group is carried by its parent, and
    // moving both would double the delta.
    const movingGroups = selectedGroupIds(ids)
      .map((id) => groupsRef.current.find((g) => g.id === id))
      .filter((g): g is LayoutGroup => Boolean(g) && !parentGroupOf(g!.id, groupsRef.current))
      .filter(
        (g) => !selectedGroupIds(ids).some((other) => other !== g.id && contains(other, g.id)),
      );
    // Every frame and member field inside a moving group renders translated.
    const frameIds = new Set<string>();
    const memberIds = new Set<string>();
    for (const g of movingGroups) {
      const visit = (grp: LayoutGroup) => {
        if (frameIds.has(grp.id)) return;
        frameIds.add(grp.id);
        for (const ref of grp.children) {
          const nested = parseGroupChildRef(ref);
          const child = nested ? groupsRef.current.find((x) => x.id === nested) : undefined;
          if (child) visit(child);
        }
      };
      visit(g);
      for (const key of groupFieldKeys(g, groupsRef.current)) {
        const f = fieldsRef.current.find((x) => x.fieldKey === key);
        if (f) memberIds.add(f.id);
      }
    }
    if (!startRects.length && !movingGroups.length) return;

    // The bounding box spans everything travelling — loose fields and group
    // frames alike — so snapping and the stay-on-canvas clamp treat a mixed
    // selection as one object.
    const spans = [
      ...startRects.map((r) => ({
        l: r.tlx,
        t: r.tly,
        r: r.tlx + r.f.width,
        b: r.tly + r.f.height,
      })),
      ...movingGroups.flatMap((g) => {
        const rect = layoutRef.current.groupRects.get(g.id);
        return rect
          ? [{ l: rect.x, t: rect.y, r: rect.x + rect.width, b: rect.y + rect.height }]
          : [];
      }),
    ];
    const bbox = {
      l: Math.min(...spans.map((s) => s.l)),
      t: Math.min(...spans.map((s) => s.t)),
      r: Math.max(...spans.map((s) => s.r)),
      b: Math.max(...spans.map((s) => s.b)),
    };
    const targets = snapTargets(new Set([...dragSet, ...memberIds]));
    let latest: Map<string, Partial<TemplateField>> | null = null;
    let latestDelta = { dx: 0, dy: 0 };

    startDrag(e.nativeEvent, containerRef.current!, {
      threshold: DRAG_THRESHOLD_PX,
      onMove: (dx, dy, ev) => {
        const s = scaleRef.current;
        let ddx = dx / s;
        let ddy = dy / s;
        // Shift locks to the dominant axis — re-read from the raw deltas
        // every frame, so the lock follows the pointer's larger travel and
        // releasing shift mid-drag frees both axes again.
        const lockX = ev.shiftKey && Math.abs(dx) < Math.abs(dy);
        const lockY = ev.shiftKey && !lockX;
        if (lockX) ddx = 0;
        if (lockY) ddy = 0;
        const guides: Guide[] = [];
        if (!ev.metaKey && !ev.ctrlKey) {
          const thresh = SNAP_SCREEN_PX / s;
          if (!lockX) {
            const sx = snapAxis(bbox.l + ddx, bbox.r + ddx, targets.v, thresh);
            ddx += sx.adjust;
            if (sx.guide !== null) guides.push({ axis: "v", pos: sx.guide });
          }
          if (!lockY) {
            const sy = snapAxis(bbox.t + ddy, bbox.b + ddy, targets.h, thresh);
            ddy += sy.adjust;
            if (sy.guide !== null) guides.push({ axis: "h", pos: sy.guide });
          }
        }
        // Never lose an element off the canvas: enough of the selection must
        // stay inside to grab it again. Clamped live, so there is no
        // snap-back at release.
        ddx = Math.min(ddx, canvasWidth - MIN_VISIBLE - bbox.l);
        ddx = Math.max(ddx, MIN_VISIBLE - bbox.r);
        ddy = Math.min(ddy, canvasHeight - MIN_VISIBLE - bbox.t);
        ddy = Math.max(ddy, MIN_VISIBLE - bbox.b);
        const overrides = new Map<string, Partial<TemplateField>>();
        for (const r of startRects) {
          overrides.set(r.f.id, toAnchorSpace(r.f, r.tlx + ddx, r.tly + ddy));
        }
        latest = overrides;
        latestDelta = { dx: ddx, dy: ddy };
        setFrame({
          kind: "move",
          overrides,
          guides,
          groupDelta: movingGroups.length
            ? { groupIds: frameIds, fieldIds: memberIds, dx: ddx, dy: ddy }
            : undefined,
        });
      },
      onEnd: () => {
        setFrame(null);
        if (!latest) return;
        // Fields and groups commit TOGETHER — one draft write, one undo entry,
        // however mixed the selection was.
        onMoveSelectionRef.current({
          fields: [...latest].map(([id, patch]) => ({ id, ...patch })),
          groupIds: movingGroups.map((g) => g.id),
          dx: latestDelta.dx,
          dy: latestDelta.dy,
        });
      },
      onCancel: () => setFrame(null),
      onTap: () => {
        // A plain click on one element of a multi-selection narrows the
        // selection to it — the drag path already handled everything else.
        if (reduceOnTap) onSelectRef.current([primaryId]);
      },
    });
  };

  // --- Child reorder (drag within the stack) -------------------------------

  /** Dragging a grouped child moves it ALONG the stack axis and re-slots it:
   * on release the child lands at the index its center crossed into. The
   * stack order lives on the group (a third ordering — never the form order,
   * never zIndex). */
  const beginChildReorder = (e: React.PointerEvent, f: TemplateField) => {
    const group = directGroupOf(f.fieldKey);
    // Plain-group children have no stack order to drag along — the pointer
    // dispatch routes them to a free move instead.
    if (!group || isFreeGroup(group)) return;
    const vertical = group.direction === "vertical";
    const myRect = displayRect(f);
    const slots = group.children.map((ref) => {
      const gid = parseGroupChildRef(ref);
      let r: Rect | undefined;
      if (gid) {
        r = layoutRef.current.groupRects.get(gid);
      } else {
        const fld = fieldsRef.current.find((x) => x.fieldKey === ref);
        r = fld ? layoutRef.current.fieldRects.get(fld.id) : undefined;
      }
      return { ref, center: r ? (vertical ? r.y + r.height / 2 : r.x + r.width / 2) : 0 };
    });
    if (!group.children.includes(f.fieldKey)) return;
    let latest = 0;

    startDrag(e.nativeEvent, containerRef.current!, {
      threshold: DRAG_THRESHOLD_PX,
      onMove: (dx, dy) => {
        const s = scaleRef.current;
        latest = (vertical ? dy : dx) / s;
        setFrame({
          kind: "reorder",
          overrides: new Map(),
          guides: [],
          reorderDelta: {
            fieldId: f.id,
            dx: vertical ? 0 : latest,
            dy: vertical ? latest : 0,
          },
        });
      },
      onEnd: () => {
        setFrame(null);
        if (!latest) return;
        const myCenter =
          (vertical ? myRect.y + myRect.height / 2 : myRect.x + myRect.width / 2) + latest;
        const others = slots.filter((s2) => s2.ref !== f.fieldKey);
        let insert = others.length;
        for (let i = 0; i < others.length; i++) {
          if (myCenter < others[i].center) {
            insert = i;
            break;
          }
        }
        const next = others.map((s2) => s2.ref);
        next.splice(insert, 0, f.fieldKey);
        if (next.join(" ") !== group.children.join(" ")) {
          onReorderChildrenRef.current(group.id, next);
        }
      },
      onCancel: () => setFrame(null),
    });
  };

  // --- Resize (single selection, 8 handles) --------------------------------

  const beginResize = (
    e: React.PointerEvent,
    f: TemplateField,
    dirX: -1 | 0 | 1,
    dirY: -1 | 0 | 1,
  ) => {
    const tlx0 = displayX(f);
    const tly0 = displayY(f);
    const w0 = f.width;
    const h0 = f.height;
    const rad = ((f.rotation ?? 0) * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const unrotated = !f.rotation;
    const targets = snapTargets(new Set([f.id]));
    const c0x = tlx0 + w0 / 2;
    const c0y = tly0 + h0 / 2;
    let latest: Map<string, Partial<TemplateField>> | null = null;

    startDrag(e.nativeEvent, containerRef.current!, {
      threshold: DRAG_THRESHOLD_PX,
      onMove: (dx, dy, ev) => {
        const s = scaleRef.current;
        // The pointer delta expressed along the element's own axes, so a
        // rotated box resizes along its edges, not the screen's.
        const cdx = dx / s;
        const cdy = dy / s;
        const ldx = cos * cdx + sin * cdy;
        const ldy = -sin * cdx + cos * cdy;
        // Modifiers read live from the event, so pressing or releasing them
        // mid-drag takes effect on the very next frame.
        const fromCenter = ev.altKey;
        const proportional = ev.shiftKey;
        // From-center: the pointer moves one edge, the mirror edge follows.
        const k = fromCenter ? 2 : 1;
        let w1 = dirX !== 0 ? w0 + dirX * ldx * k : w0;
        let h1 = dirY !== 0 ? h0 + dirY * ldy * k : h0;
        const guides: Guide[] = [];

        /** Where the handle-side vertical/horizontal edge currently sits. */
        const movingEdgeX = () =>
          fromCenter ? c0x + (dirX * w1) / 2 : dirX === 1 ? tlx0 + w1 : tlx0 + w0 - w1;
        const movingEdgeY = () =>
          fromCenter ? c0y + (dirY * h1) / 2 : dirY === 1 ? tly0 + h1 : tly0 + h0 - h1;
        /** Grow/shrink one axis so its moving edge lands on the snapped
         * position (a from-center edge moves at half the rate of the size). */
        const applyX = (adjust: number) => (w1 += dirX * adjust * k);
        const applyY = (adjust: number) => (h1 += dirY * adjust * k);

        const snappable = unrotated && !ev.metaKey && !ev.ctrlKey;
        const thresh = SNAP_SCREEN_PX / s;

        if (proportional) {
          // One scale factor for both axes, driven by whichever axis the
          // pointer has changed more; the other follows. Snap the driving
          // edge first so the ratio is computed from the snapped size.
          const sxr = dirX !== 0 ? w1 / w0 : null;
          const syr = dirY !== 0 ? h1 / h0 : null;
          const driveX = sxr !== null && (syr === null || Math.abs(sxr - 1) >= Math.abs(syr - 1));
          if (snappable) {
            if (driveX) {
              const hit = snapAxis(movingEdgeX(), movingEdgeX(), targets.v, thresh);
              if (hit.guide !== null) {
                applyX(hit.adjust);
                guides.push({ axis: "v", pos: hit.guide });
              }
            } else {
              const hit = snapAxis(movingEdgeY(), movingEdgeY(), targets.h, thresh);
              if (hit.guide !== null) {
                applyY(hit.adjust);
                guides.push({ axis: "h", pos: hit.guide });
              }
            }
          }
          let sc = driveX ? w1 / w0 : h1 / h0;
          sc = Math.max(sc, MIN_SIZE / w0, MIN_SIZE / h0);
          w1 = w0 * sc;
          h1 = h0 * sc;
        } else {
          if (snappable && dirX !== 0) {
            const hit = snapAxis(movingEdgeX(), movingEdgeX(), targets.v, thresh);
            if (hit.guide !== null) {
              applyX(hit.adjust);
              guides.push({ axis: "v", pos: hit.guide });
            }
          }
          if (snappable && dirY !== 0) {
            const hit = snapAxis(movingEdgeY(), movingEdgeY(), targets.h, thresh);
            if (hit.guide !== null) {
              applyY(hit.adjust);
              guides.push({ axis: "h", pos: hit.guide });
            }
          }
          // The box stops at the minimum while the cursor keeps going, and —
          // because every frame recomputes from the start rect — picks back
          // up the moment the cursor returns. No jump at release.
          w1 = Math.max(MIN_SIZE, w1);
          h1 = Math.max(MIN_SIZE, h1);
        }

        // The fixed point is the center (alt) or the corner/edge opposite
        // the handle, held in world space; the new center falls out of it.
        // Computed fresh from the start rect every frame — nothing
        // accumulates, so nothing drifts.
        let c1x = c0x;
        let c1y = c0y;
        if (!fromCenter) {
          const ax = (-dirX * w0) / 2;
          const ay = (-dirY * h0) / 2;
          const awx = c0x + cos * ax - sin * ay;
          const awy = c0y + sin * ax + cos * ay;
          const nx = (dirX * w1) / 2;
          const ny = (dirY * h1) / 2;
          c1x = awx + cos * nx - sin * ny;
          c1y = awy + sin * nx + cos * ny;
        }
        const tlx1 = c1x - w1 / 2;
        const tly1 = c1y - h1 / 2;
        const overrides = new Map<string, Partial<TemplateField>>([
          [f.id, { ...toAnchorSpace(f, tlx1, tly1, w1, h1), width: w1, height: h1 }],
        ]);
        latest = overrides;
        setFrame({ kind: "resize", overrides, guides });
      },
      onEnd: () => {
        setFrame(null);
        // A resize changes the BOX and only the box: font size is a property
        // the admin sets, never a side effect of a drag. Fitting modes
        // (shrink / fixed) keep deriving their displayed size from the new
        // width exactly as they will render after release.
        if (!latest) return;
        // A stack child's position is computed by the stack, and a text
        // child's main-axis size hugs its content — only the authored
        // dimensions commit. (Plain-group children commit like any field.)
        if (inStack(f)) {
          const stripped = new Map<string, Partial<TemplateField>>();
          for (const [id, o] of latest) {
            const isText = f.type !== "image" && f.type !== "shape";
            const vertical = directGroupOf(f.fieldKey)?.direction !== "horizontal";
            const patch: Partial<TemplateField> = { width: o.width, height: o.height };
            if (isText && vertical) delete patch.height;
            if (isText && !vertical) delete patch.width;
            stripped.set(id, patch);
          }
          commitOverrides(stripped);
          return;
        }
        commitOverrides(latest);
      },
      onCancel: () => setFrame(null),
    });
  };

  // --- Rotate ---------------------------------------------------------------

  const beginRotate = (e: React.PointerEvent, f: TemplateField) => {
    const cx = displayX(f) + f.width / 2;
    const cy = displayY(f) + f.height / 2;
    const p0 = toCanvasFree(e);
    const a0 = Math.atan2(p0.y - cy, p0.x - cx);
    const r0 = f.rotation ?? 0;
    let latest: Map<string, Partial<TemplateField>> | null = null;

    startDrag(e.nativeEvent, containerRef.current!, {
      threshold: DRAG_THRESHOLD_PX,
      onMove: (_dx, _dy, ev) => {
        const p = toCanvasFree(ev);
        const a = Math.atan2(p.y - cy, p.x - cx);
        let deg = r0 + ((a - a0) * 180) / Math.PI;
        if (ev.shiftKey) deg = Math.round(deg / 15) * 15;
        const overrides = new Map<string, Partial<TemplateField>>([[f.id, { rotation: deg }]]);
        latest = overrides;
        setFrame({ kind: "rotate", overrides, guides: [] });
      },
      onEnd: () => {
        setFrame(null);
        if (latest) commitOverrides(latest);
      },
      onCancel: () => setFrame(null),
    });
  };

  // --- Draw-to-create (empty canvas) ---------------------------------------

  const beginDraw = (e: React.PointerEvent) => {
    onSelectRef.current([]);
    const p0 = toCanvas(e);
    let last: DrawState | null = null;

    startDrag(e.nativeEvent, containerRef.current!, {
      threshold: DRAG_THRESHOLD_PX,
      onMove: (_dx, _dy, ev) => {
        const p = toCanvas(ev);
        last = {
          startX: p0.x,
          startY: p0.y,
          x: Math.min(p0.x, p.x),
          y: Math.min(p0.y, p.y),
          w: Math.abs(p.x - p0.x),
          h: Math.abs(p.y - p0.y),
        };
        setDraw(last);
      },
      onEnd: () => {
        setDraw(null);
        if (last && last.w > 24 && last.h > 24) {
          onDraw({
            x: Math.round(last.x),
            y: Math.round(last.y),
            width: Math.round(last.w),
            height: Math.round(last.h),
          });
        }
      },
      onCancel: () => setDraw(null),
    });
  };

  // --- Render ---------------------------------------------------------------

  const selected = fields.filter((f) => selectedIds.includes(f.id));
  const single = selected.length === 1 ? selected[0] : null;

  /** The field as currently shown: draft state plus any live gesture frame. */
  const viewOf = (f: TemplateField): TemplateField => {
    const o = frame?.overrides.get(f.id);
    return o ? { ...f, ...o } : f;
  };

  return (
    <div className="relative w-full" style={{ aspectRatio: `${canvasWidth} / ${canvasHeight}` }}>
      <div ref={viewportRef} className="absolute inset-0 overflow-auto">
        <div
          ref={containerRef}
          data-overlay-root
          className="relative select-none touch-none overflow-hidden"
          style={{
            width: canvasWidth * scale,
            height: canvasHeight * scale,
            cursor: "crosshair",
          }}
          onDragOver={(e) => {
            if (
              e.dataTransfer.types.includes(PALETTE_MIME) ||
              e.dataTransfer.types.includes("Files")
            ) {
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
            }
          }}
          onDrop={(e) => {
            const paletteId = e.dataTransfer.getData(PALETTE_MIME);
            if (paletteId) {
              e.preventDefault();
              onDropElement(paletteId, toCanvas(e));
              return;
            }
            const files = Array.from(e.dataTransfer.files).filter((f) =>
              f.type.startsWith("image/"),
            );
            if (files.length) {
              e.preventDefault();
              onDropFiles(files, toCanvas(e));
            }
          }}
          onContextMenu={(e) => {
            const target = e.target as HTMLElement;
            if (target !== e.currentTarget && target.dataset.role !== "bg") return;
            e.preventDefault();
            onContextMenu({ x: e.clientX, y: e.clientY }, null, toCanvas(e));
          }}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            const target = e.target as HTMLElement;
            if (target !== e.currentTarget && target.dataset.role !== "bg") return;
            beginDraw(e);
          }}
        >
          {/* A background that can't be signed or fetched leaves the canvas
              looking merely blank — say so, or the admin designs against a
              backdrop that isn't there. Screen space, so it stays readable
              at any zoom. */}
          {background.failed && (
            <div
              style={{
                position: "absolute",
                top: 12,
                left: 12,
                zIndex: 10001,
                padding: "6px 10px",
                background: "rgba(0,0,0,0.65)",
                color: "#fff",
                fontSize: 13,
                borderRadius: 6,
                pointerEvents: "none",
              }}
            >
              Background image failed to load
            </div>
          )}
          {/* Background at canvas scale */}
          <div
            style={{
              width: canvasWidth,
              height: canvasHeight,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              position: "absolute",
              top: 0,
              left: 0,
              background: backgroundCss ?? "#fff",
              pointerEvents: "none",
            }}
          >
            {backgroundDataUrl && (
              <img
                src={backgroundDataUrl}
                alt=""
                data-role="bg"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            )}
          </div>

          {/* Group frames: builder-only chrome (never in preview or export).
          They sit UNDER the child boxes in DOM order, so children win clicks
          and the frame catches the gaps. */}
          {groups.map((g) => {
            const r0 = layout.groupRects.get(g.id);
            if (!r0) return null;
            const gd = frame?.groupDelta;
            const dgx = gd && gd.groupIds.has(g.id) ? gd.dx : 0;
            const dgy = gd && gd.groupIds.has(g.id) ? gd.dy : 0;
            const gref = groupChildRef(g.id);
            const isSel = selectedIds.includes(gref);
            const overflow = overflowGroupIds.includes(g.id);
            const isTop = !parentGroupOf(g.id, groups);
            return (
              <div
                key={g.id}
                onPointerDown={(e) => {
                  if (e.button !== 0 || !isTop) return;
                  e.stopPropagation();
                  // Groups join a multi-selection like any element, and drag
                  // with it — shift/⌘ toggles membership.
                  const multi = e.shiftKey || e.metaKey || e.ctrlKey;
                  let ids: string[];
                  if (multi) {
                    ids = isSel ? selectedIds.filter((id) => id !== gref) : [...selectedIds, gref];
                    onSelect(ids);
                    if (!ids.includes(gref)) return; // toggled off — nothing to drag
                  } else {
                    ids = isSel ? selectedIds : [gref];
                    if (!isSel) onSelect(ids);
                  }
                  beginMove(e, ids, gref, !multi && isSel && selectedIds.length > 1);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!isSel) onSelect([gref]);
                  onContextMenu({ x: e.clientX, y: e.clientY }, gref, toCanvas(e));
                }}
                style={{
                  position: "absolute",
                  left: (r0.x + dgx) * scale,
                  top: (r0.y + dgy) * scale,
                  width: r0.width * scale,
                  height: r0.height * scale,
                  zIndex: 1,
                  // Same rule as elements — except an overflowing frame keeps
                  // its warning outline whether or not you are looking at it.
                  border:
                    isSel || flashGroupId === g.id
                      ? "var(--editor-line) solid var(--editor-accent)"
                      : overflow
                        ? "var(--editor-line) dashed color-mix(in srgb, var(--destructive) 55%, transparent)"
                        : hoveredGroupId === g.id
                          ? "var(--editor-line) dashed color-mix(in srgb, var(--editor-accent) 55%, transparent)"
                          : "var(--editor-line) solid transparent",
                  background: "transparent",
                  cursor: isTop ? "move" : "default",
                }}
                onMouseEnter={() => isTop && setHoveredGroupId(g.id)}
                onMouseLeave={() => setHoveredGroupId((id) => (id === g.id ? null : id))}
              >
                {/* Group chip: the overflow warning always shows (it carries real
                information); the name shows only mid-drag. Plain selection
                stays chip-free — the inspector names the group. */}
                {(overflow || flashGroupId === g.id || (gd && gd.groupIds.has(g.id))) && (
                  <span
                    className="absolute -top-4 left-0 rounded whitespace-nowrap"
                    style={{
                      background: overflow ? "var(--destructive)" : "var(--editor-accent)",
                      color: "var(--text-on-action)",
                      fontSize: 9,
                      fontWeight: 500,
                      padding: "1px 4px",
                      pointerEvents: "none",
                    }}
                  >
                    {g.name}
                    {overflow ? " · outside canvas" : ""}
                  </span>
                )}
              </div>
            );
          })}

          {/* Field boxes (screen space = canvas × scale; z = canvas layer order) */}
          {fields.map((f) => {
            const v = viewOf(f);
            const grouped = isGrouped(f);
            // Display geometry: an active free gesture (move/resize/rotate) owns
            // the box; otherwise the layout pass does — grouped children render
            // at their computed, hugged rects, ungrouped at authored ones.
            const hasOverride = Boolean(frame?.overrides.has(f.id));
            const base: { x: number; y: number; width: number; height: number } = hasOverride
              ? { x: displayX(v), y: displayY(v), width: v.width, height: v.height }
              : displayRect(f);
            const gd = frame?.groupDelta;
            const rd = frame?.reorderDelta;
            const box = {
              x: base.x + (gd?.fieldIds.has(f.id) ? gd.dx : 0) + (rd?.fieldId === f.id ? rd.dx : 0),
              y: base.y + (gd?.fieldIds.has(f.id) ? gd.dy : 0) + (rd?.fieldId === f.id ? rd.dy : 0),
              width: base.width,
              height: base.height,
            };
            const isSelected = selectedIds.includes(f.id);
            const isEditing = editingId === f.id;
            const showHandles = isSelected && single?.id === f.id && !isEditing;
            const isText = f.type !== "image" && f.type !== "shape";
            const stackChild = inStack(f);
            const groupVertical = stackChild
              ? directGroupOf(f.fieldKey)?.direction !== "horizontal"
              : false;
            // The whole EDGE is the resize surface (strips below); the dots are
            // wayfinding. A mid-edge dot renders only where it has room between
            // the corners — on a short or narrow box it would crowd them — but
            // dropping a dot never costs the interaction, because its edge strip
            // stays grabbable at any size.
            //
            // Computed extents aren't draggable. Text height is computed
            // wherever it hugs content: Free fields (any context) and children
            // of a vertical stack — their vertical edges drop, corners (which
            // resize both axes) too. Children of a horizontal stack hug their
            // width instead. Shrink fields keep every handle: their box is the
            // constraint the admin draws.
            const hugsHeight =
              isText &&
              (resolveFieldStyle(f, kit).textSizing !== "shrink" || (stackChild && groupVertical));
            const allowDir = (dx: number, dy: number): boolean => {
              if (!isText) return true;
              if (dy !== 0 && hugsHeight) return false;
              if (dx !== 0 && stackChild && !groupVertical) return false;
              return true;
            };
            const handleDirs = RESIZE_DIRS.filter(
              ({ dx, dy }) =>
                allowDir(dx, dy) &&
                ((dx !== 0 && dy !== 0) ||
                  (dy === 0
                    ? box.height * scale >= HANDLE_CROWD_PX
                    : box.width * scale >= HANDLE_CROWD_PX)),
            );
            const edgeStrips = EDGE_STRIPS.filter(({ dx, dy }) => allowDir(dx, dy));
            return (
              <div
                key={f.id}
                onPointerDown={(e) => {
                  if (e.button !== 0) return;
                  e.stopPropagation();
                  // While editing text in this box, the pointer belongs to the
                  // editor — no drags, no reselection.
                  if (editingId === f.id) return;
                  // Alt-click digs through the stack: each click selects the
                  // next element beneath the pointer, wrapping at the bottom —
                  // and drags it in the same gesture.
                  if (e.altKey && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
                    const p = toCanvas(e);
                    const stack = paintOrder(fieldsRef.current)
                      .reverse()
                      .filter((sf) => hitTestRect(displayRect(sf), sf.rotation, p));
                    if (stack.length > 1) {
                      const cur = stack.findIndex((sf) => selectedIds.includes(sf.id));
                      const next = stack[(cur + 1) % stack.length];
                      onSelect([next.id]);
                      if (!inStack(next)) beginMove(e, [next.id], next.id, false);
                      return;
                    }
                  }
                  const multi = e.shiftKey || e.metaKey || e.ctrlKey;
                  // Grouped child, plain click: FIRST click selects the whole
                  // group (drag moves it); a click while the group is selected
                  // goes down INTO the child — dragging a stack child re-slots
                  // it, dragging a plain-group child just moves it (that is the
                  // point of a plain group).
                  if (grouped && !multi) {
                    const outer = outermostGroupOf(f.fieldKey, groupsRef.current);
                    const outerRef = outer ? groupChildRef(outer.id) : null;
                    // Not already working inside this group (neither it nor
                    // any of its elements selected)? The click belongs to the
                    // group as a whole.
                    const insideSelected =
                      outerRef &&
                      (selectedIds.includes(outerRef) ||
                        selectedIds.some((id) => {
                          const sf = fieldsRef.current.find((x) => x.id === id);
                          return (
                            sf && outermostGroupOf(sf.fieldKey, groupsRef.current)?.id === outer?.id
                          );
                        }));
                    if (outerRef && !insideSelected) {
                      onSelect([outerRef]);
                      beginMove(e, [outerRef], outerRef, false);
                      return;
                    }
                    if (!isSelected) onSelect([f.id]);
                    if (inStack(f)) beginChildReorder(e, f);
                    else beginMove(e, [f.id], f.id, false);
                    return;
                  }
                  let ids: string[];
                  if (multi) {
                    ids = isSelected
                      ? selectedIds.filter((id) => id !== f.id)
                      : [...selectedIds, f.id];
                    onSelect(ids);
                    // Toggled OFF — a drag from a just-deselected element would
                    // move everything else out from under the pointer.
                    if (!ids.includes(f.id)) return;
                  } else {
                    ids = isSelected ? selectedIds : [f.id];
                    if (!isSelected) onSelect([f.id]);
                  }
                  // Selection and drag are ONE gesture — pressing an unselected
                  // element and pulling moves it immediately, first time.
                  beginMove(e, ids, f.id, !multi && isSelected && selectedIds.length > 1);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  if (f.static && (f.type === "text" || f.type === "multiline")) {
                    // Fixed text: its content lives on the canvas — edit it there.
                    setEditingId(f.id);
                  } else {
                    // Member-editable elements have no builder-side content; the
                    // double-clickable text is their NAME, over in the inspector.
                    onRequestLabelFocus(f.id);
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!isSelected) onSelect([f.id]);
                  onContextMenu({ x: e.clientX, y: e.clientY }, f.id, toCanvas(e));
                }}
                onMouseEnter={() => setHoveredId(f.id)}
                onMouseLeave={() => setHoveredId((id) => (id === f.id ? null : id))}
                style={{
                  position: "absolute",
                  left: box.x * scale,
                  top: box.y * scale,
                  width: box.width * scale,
                  height: box.height * scale,
                  zIndex: (f.zIndex ?? 0) + 2, // above the background AND group frames
                  transform: v.rotation ? `rotate(${v.rotation}deg)` : undefined,
                  // Outlines are for the element you are working with, not for
                  // every element at once — a canvas of dashed boxes hides the
                  // design it is supposed to show. The border stays declared at
                  // the same width and only loses its color, so nothing shifts.
                  border: isSelected
                    ? "var(--editor-line) solid var(--editor-accent)"
                    : hoveredId === f.id || hasOverride
                      ? "var(--editor-line) dashed color-mix(in srgb, var(--editor-accent) 65%, transparent)"
                      : "var(--editor-line) solid transparent",
                  // The outline follows the element's corner radius wherever the
                  // renderer honors one (images, rect shapes) — a square outline
                  // over a rounded element reads as "the radius didn't apply".
                  // THIS box is screen-sized, so the radius scales with it;
                  // canvas-pixel radii here would be wrong by 1/scale.
                  borderRadius:
                    f.type === "image" || (f.type === "shape" && (f.shape ?? "rect") === "rect")
                      ? cornerRadiusCss(f, scale)
                      : undefined,
                  // Content lives INSIDE the box — no fill, the outline and
                  // handles carry selection.
                  background: "transparent",
                  cursor: isEditing ? "text" : stackChild ? "grab" : "move",
                }}
              >
                {/* The field's real appearance, riding inside the interaction box.
                Sized in canvas units from the LIVE view geometry and scaled
                down uniformly — during a resize the box gets real dimensions
                every frame, so text reflows as it will look, never a
                stretched glyph preview. */}
                {isEditing ? (
                  <InlineTextEditor
                    field={{ ...v, width: box.width, height: box.height }}
                    brandKit={kit}
                    scale={scale}
                    onCommit={(text) =>
                      onChangeRef.current(
                        fieldsRef.current.map((cf) =>
                          cf.id === f.id ? { ...cf, staticValue: text || undefined } : cf,
                        ),
                      )
                    }
                    onExit={() => setEditingId(null)}
                  />
                ) : (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      overflow: "hidden",
                      pointerEvents: "none",
                    }}
                  >
                    <div
                      data-field-content
                      style={{
                        width: box.width,
                        height: box.height,
                        transform: `scale(${scale})`,
                        transformOrigin: "top left",
                        pointerEvents: "none",
                      }}
                    >
                      {/* Field boundary: a malformed element degrades to a
                      placeholder that stays selectable, movable, and
                      deletable — the admin can fix or remove it. Any edit
                      to the field resets the boundary. */}
                      <ErrorBoundary
                        level="field"
                        context={{ fieldId: f.id, fieldType: f.type }}
                        resetKeys={[v]}
                        fallback={() => (
                          <FieldCrashFallback width={box.width} height={box.height} />
                        )}
                      >
                        <FieldContent
                          field={grouped ? { ...v, width: box.width, height: box.height } : v}
                          value={values?.[f.fieldKey]}
                          brandKit={kit}
                          fontSize={layout.fontSizes.get(f.id)}
                        />
                      </ErrorBoundary>
                    </div>
                  </div>
                )}
                {/* Name chip: wayfinding while the pointer is involved — hover,
                or this element's own drag. NOT on mere selection: chips sit
                over the element above, and the inspector and field list
                already name the selection. */}
                {(hoveredId === f.id ||
                  Boolean(frame?.overrides.has(f.id)) ||
                  frame?.reorderDelta?.fieldId === f.id) && (
                  <span
                    className="absolute -top-4 left-0 rounded whitespace-nowrap"
                    style={{
                      background: "var(--editor-accent)",
                      color: "#fff",
                      fontSize: 9,
                      fontWeight: 500,
                      padding: "1px 4px",
                      pointerEvents: "none",
                    }}
                  >
                    {f.label}
                    {(() => {
                      // "Image · image" says nothing — suppress the type when it
                      // duplicates the label. "fixed" carries information except
                      // on shapes, which are always design-only.
                      const segment =
                        f.type === "shape"
                          ? null
                          : f.static
                            ? "fixed"
                            : f.label.trim().toLowerCase() === f.type
                              ? null
                              : f.type;
                      return segment ? ` · ${segment}` : "";
                    })()}
                  </span>
                )}

                {/* Transform chrome: 8 resize handles + the rotate handle, only
                on a single selection. Children of the box, so they rotate
                and travel with it for free. */}
                {showHandles && (
                  <>
                    <div
                      title="Rotate (shift snaps to 15°)"
                      onPointerDown={(e) => {
                        if (e.button !== 0) return;
                        e.stopPropagation();
                        beginRotate(e, f);
                      }}
                      style={{
                        position: "absolute",
                        left: "50%",
                        top: -26,
                        transform: "translateX(-50%)",
                        width: 16,
                        height: 16,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "grab",
                      }}
                    >
                      <span
                        style={{
                          width: 9,
                          height: 9,
                          borderRadius: "50%",
                          background: "var(--bg-surface)",
                          border: "var(--editor-line) solid var(--editor-accent)",
                        }}
                      />
                    </div>
                    <div
                      style={{
                        position: "absolute",
                        left: "50%",
                        top: -12,
                        width: 1,
                        height: 12,
                        background: "var(--editor-accent)",
                        pointerEvents: "none",
                      }}
                    />
                    {edgeStrips.map(({ dx, dy, cursor, style }) => (
                      <div
                        key={`edge${dx},${dy}`}
                        data-resize-edge={`${dx},${dy}`}
                        onPointerDown={(e) => {
                          if (e.button !== 0) return;
                          e.stopPropagation();
                          beginResize(e, f, dx, dy);
                        }}
                        style={{ position: "absolute", cursor, ...style }}
                      />
                    ))}
                    {handleDirs.map(({ dx, dy, cursor }) => (
                      <div
                        key={`${dx},${dy}`}
                        onPointerDown={(e) => {
                          if (e.button !== 0) return;
                          e.stopPropagation();
                          beginResize(e, f, dx, dy);
                        }}
                        style={{
                          position: "absolute",
                          left: `${(dx + 1) * 50}%`,
                          top: `${(dy + 1) * 50}%`,
                          transform: "translate(-50%, -50%)",
                          width: 14,
                          height: 14,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor,
                        }}
                      >
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            background: "var(--bg-surface)",
                            border: "var(--editor-line) solid var(--editor-accent)",
                          }}
                        />
                      </div>
                    ))}
                  </>
                )}

                {/* Live readout under the box: dimensions while moving/resizing,
                the angle while rotating. Derived from the same frame state
                that renders the box — it can never disagree with what shows. */}
                {showHandles && frame && (
                  <span
                    className="absolute whitespace-nowrap rounded"
                    style={{
                      top: "100%",
                      left: "50%",
                      transform: "translateX(-50%)",
                      marginTop: 6,
                      background: "var(--editor-accent)",
                      color: "#fff",
                      fontSize: 9,
                      fontWeight: 500,
                      padding: "1px 4px",
                      pointerEvents: "none",
                    }}
                  >
                    {frame.kind === "rotate"
                      ? `${Math.round(v.rotation ?? 0)}°`
                      : `${Math.round(box.width)} × ${Math.round(box.height)}`}
                  </span>
                )}
              </div>
            );
          })}

          {/* Smart guides for the active snap */}
          {frame?.guides.map((g, i) =>
            g.axis === "v" ? (
              <div
                key={`g${i}`}
                style={{
                  position: "absolute",
                  left: g.pos * scale,
                  top: 0,
                  width: 1,
                  height: "100%",
                  background: "var(--editor-accent)",
                  pointerEvents: "none",
                  zIndex: 9998,
                }}
              />
            ) : (
              <div
                key={`g${i}`}
                style={{
                  position: "absolute",
                  top: g.pos * scale,
                  left: 0,
                  height: 1,
                  width: "100%",
                  background: "var(--editor-accent)",
                  pointerEvents: "none",
                  zIndex: 9998,
                }}
              />
            ),
          )}

          {/* Draw preview */}
          {draw && draw.w > 4 && (
            <div
              style={{
                position: "absolute",
                left: draw.x * scale,
                top: draw.y * scale,
                width: draw.w * scale,
                height: draw.h * scale,
                border: "var(--editor-line) dashed var(--editor-accent)",
                background: "color-mix(in srgb, var(--editor-accent) 8%, transparent)",
                pointerEvents: "none",
                zIndex: 10000,
              }}
            />
          )}
        </div>
      </div>

      {/* Zoom, outside the scrolling viewport so it holds its corner. The
          percentage is of true canvas pixels; clicking it fits the canvas. */}
      <div
        className="absolute flex items-center"
        style={{
          right: 8,
          bottom: 8,
          gap: 2,
          padding: 2,
          borderRadius: "var(--radius-control)",
          border: "1px solid var(--border)",
          background: "var(--bg-surface)",
        }}
      >
        <button
          aria-label="Zoom out"
          title="Zoom out (⌘−)"
          disabled={zoom <= MIN_ZOOM}
          // From the ref, not the render's `zoom`: clicks land faster than
          // React re-renders, and each one must step off the last.
          onClick={() => applyZoom(zoomRef.current / ZOOM_STEP)}
          style={{ display: "flex", padding: 4, opacity: zoom <= MIN_ZOOM ? 0.4 : 1 }}
        >
          <Minus style={{ width: 13, height: 13 }} strokeWidth={1.5} />
        </button>
        <button
          aria-label={zoom === 1 ? "Canvas fits the view" : "Fit the canvas to the view"}
          title="Fit (⌘0)"
          onClick={() => applyZoom(1)}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--text-secondary)",
            minWidth: 38,
            textAlign: "center",
          }}
        >
          {Math.round(scale * 100)}%
        </button>
        <button
          aria-label="Zoom in"
          title="Zoom in (⌘+)"
          disabled={zoom >= MAX_ZOOM}
          onClick={() => applyZoom(zoomRef.current * ZOOM_STEP)}
          style={{ display: "flex", padding: 4, opacity: zoom >= MAX_ZOOM ? 0.4 : 1 }}
        >
          <Plus style={{ width: 13, height: 13 }} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
