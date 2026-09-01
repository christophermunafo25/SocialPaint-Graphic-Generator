// Shared plumbing for Brand Studio: the autosaving working copy of the kit
// (with the undo stack that makes autosave safe) and the binding usage maps
// that power the usage labels and the "this restyles N fields" notes.

import { useCallback, useEffect, useRef, useState } from "react";
import type { BrandKit, TemplateSchema } from "@/lib/types";
import { stores } from "@/lib/stores";
import { useAsync } from "@/lib/useAsync";
import { useAuth } from "@/lib/auth/AuthContext";
import { useBrand } from "@/lib/brand/BrandContext";
import { DEFAULT_PALETTE, DEFAULT_TYPE_STYLES } from "@/lib/theme";

export type KitShape = Omit<BrandKit, "id" | "companyId">;

/** The kit as the studio treats it — saved values, with the defaults that
 * stand in for anything a tenant hasn't set. */
export function kitShape(kit: BrandKit | null): KitShape {
  return {
    colors: kit?.colors ?? DEFAULT_PALETTE,
    typeStyles: kit?.typeStyles?.length ? kit.typeStyles : DEFAULT_TYPE_STYLES,
    // Guidelines have no surface anymore but the data is preserved — every
    // save carries them through untouched.
    guidelines: kit?.guidelines ?? [],
    headingFont: kit?.headingFont ?? { source: "google", family: "Montserrat" },
    bodyFont: kit?.bodyFont ?? { source: "google", family: "Inter" },
    primaryLogoAssetId: kit?.primaryLogoAssetId,
    // Enforcement lives in Settings, not the studio — but the studio's saves
    // write the whole kit, so dropping these here would silently reset them.
    allowStyleOverride: kit?.allowStyleOverride ?? false,
    allowOffPalette: kit?.allowOffPalette ?? true,
  };
}

/** A commit that can be taken back: the snapshot to restore, and the line
 * the toast shows while the offer stands. */
export interface UndoOffer {
  message: string;
  snapshot: KitShape;
}

export interface CommitOptions {
  /** Toast line. Omit for edits too small to announce (a hex nudge). */
  message?: string;
  /** Consecutive commits under the same key collapse into one undo step, so
   * dragging a color picker doesn't bury the stack under 60 entries. */
  coalesceKey?: string;
}

/** Input types with no caret, so no native undo to defer to. */
const NON_TEXT_INPUTS = new Set([
  "checkbox",
  "radio",
  "color",
  "range",
  "file",
  "button",
  "submit",
]);

function isTextEntry(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable || el.tagName === "TEXTAREA") return true;
  if (el.tagName !== "INPUT") return false;
  return !NON_TEXT_INPUTS.has((el as HTMLInputElement).type);
}

/** How long a run of same-key commits stays one undo step. */
const COALESCE_MS = 900;
/** Writes trail the keystroke by this much — the screen never waits on the
 * network, and a burst of edits costs one round trip. */
const AUTOSAVE_MS = 600;
const HISTORY_CAP = 40;
const TOAST_MS = 5000;

/** Brand Studio's working copy of the kit. Every edit lands locally at once,
 * persists a beat later, and pushes an undo step — there is no Save button
 * and no dirty state to lose. Undo is the safety net that replaces the old
 * per-category confirmation: a change that propagates says so in its toast,
 * with the way back one click away. */
export function useBrandDraft() {
  const { company } = useAuth();
  const { kit, assets, refresh } = useBrand();

  const [draft, setDraft] = useState<KitShape>(() => kitShape(kit));
  const [history, setHistory] = useState<KitShape[]>([]);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [undoOffer, setUndoOffer] = useState<UndoOffer | null>(null);

  // Adopt a kit only when a DIFFERENT one arrives (first load, company
  // switch). Our own saves refresh the context, and re-adopting there would
  // fight whatever the user typed while the write was in flight.
  const adoptedKitIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!kit || adoptedKitIdRef.current === kit.id) return;
    adoptedKitIdRef.current = kit.id;
    setDraft(kitShape(kit));
    setHistory([]);
  }, [kit]);

  const draftRef = useRef(draft);
  draftRef.current = draft;
  const saveTimer = useRef<number | undefined>(undefined);
  const toastTimer = useRef<number | undefined>(undefined);
  const lastCommit = useRef<{ key: string; at: number; start: KitShape } | null>(null);

  const pendingRef = useRef(false);

  const flush = useCallback(async () => {
    window.clearTimeout(saveTimer.current);
    if (!company) return;
    pendingRef.current = false;
    setPending(false);
    setSaving(true);
    setError(null);
    try {
      await stores.brandKits.upsert(company.id, draftRef.current);
      await refresh(); // re-theme the app + reload fonts immediately
      setSavedAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save. Your last change isn't stored.");
    } finally {
      setSaving(false);
    }
  }, [company, refresh]);

  const schedule = useCallback(() => {
    pendingRef.current = true;
    setPending(true);
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => void flush(), AUTOSAVE_MS);
  }, [flush]);

  // Leaving the studio inside the debounce window must not cost the last
  // edit — in-app navigation just unmounts us, with no unload to warn on.
  const flushRef = useRef(flush);
  flushRef.current = flush;

  const showUndo = useCallback((offer: UndoOffer | null) => {
    window.clearTimeout(toastTimer.current);
    setUndoOffer(offer);
    if (offer) toastTimer.current = window.setTimeout(() => setUndoOffer(null), TOAST_MS);
  }, []);

  const commit = useCallback(
    (patch: Partial<KitShape>, options: CommitOptions = {}) => {
      const before = draftRef.current;
      const now = Date.now();
      const coalesced =
        !!options.coalesceKey &&
        lastCommit.current?.key === options.coalesceKey &&
        now - lastCommit.current.at < COALESCE_MS;
      lastCommit.current = options.coalesceKey
        ? {
            key: options.coalesceKey,
            at: now,
            start: coalesced ? lastCommit.current!.start : before,
          }
        : null;
      // A coalesced run keeps pointing at where it began, so undo after a
      // picker drag returns to the color you started from, not the last frame.
      const step = coalesced ? lastCommit.current!.start : before;

      setDraft({ ...before, ...patch });
      draftRef.current = { ...before, ...patch };
      if (!coalesced) setHistory((h) => [...h.slice(-(HISTORY_CAP - 1)), before]);
      if (options.message) showUndo({ message: options.message, snapshot: step });
      schedule();
    },
    [schedule, showUndo],
  );

  const undo = useCallback(
    (snapshot?: KitShape) => {
      const target = snapshot ?? (history.length ? history[history.length - 1] : undefined);
      if (!target) return;
      if (!snapshot) setHistory((h) => h.slice(0, -1));
      else setHistory((h) => h.filter((s) => s !== target));
      setDraft(target);
      draftRef.current = target;
      lastCommit.current = null;
      showUndo(null);
      void flush();
    },
    [history, flush, showUndo],
  );

  // ⌘Z anywhere on the page, except where the browser's own text undo is
  // what the user means. A focused checkbox or swatch has no text undo to
  // defer to, so the shortcut still reaches the kit from there.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.key.toLowerCase() !== "z") return;
      if (isTextEntry(e.target)) return;
      e.preventDefault();
      undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo]);

  useEffect(
    () => () => {
      window.clearTimeout(saveTimer.current);
      window.clearTimeout(toastTimer.current);
      if (pendingRef.current) void flushRef.current();
    },
    [],
  );

  return {
    company,
    kit,
    assets,
    refresh,
    draft,
    commit,
    undo,
    canUndo: history.length > 0,
    undoOffer,
    dismissUndo: () => showUndo(null),
    savedAt,
    saving,
    /** An edit is made but not yet written — the unload guard reads this. */
    pending,
    error,
    setError,
    /** Write now (used when leaving the page can't wait for the debounce). */
    flush,
  };
}

export type BrandDraft = ReturnType<typeof useBrandDraft>;

/** Fields/templates bound to one style or color key. */
export interface BindingUsage {
  fields: number;
  templateNames: string[];
}

export const usageLabel = (u: BindingUsage | undefined): string =>
  !u || u.fields === 0
    ? "Not used yet"
    : `Used by ${u.fields} field${u.fields === 1 ? "" : "s"} in ${u.templateNames.length} template${u.templateNames.length === 1 ? "" : "s"}`;

/** The blast radius: which fields across which templates bind to each type
 * style. Fields carry no palette binding of their own — a palette color
 * reaches templates only THROUGH a type style that names it, so color usage
 * derives from style usage. If loading is slow or fails, callers simply
 * render without counts. */
export function useBrandBindings(kit: BrandKit | null) {
  const { company } = useAuth();
  const templatesState = useAsync<TemplateSchema[]>(
    () => (company ? stores.templates.listAll(company.id) : Promise.resolve([])),
    [company],
  );
  const templates = templatesState.status === "ready" ? templatesState.data : null;

  const styleUse = new Map<string, BindingUsage>();
  const colorUse = new Map<string, BindingUsage>();
  const add = (map: Map<string, BindingUsage>, key: string, templateName: string) => {
    const u = map.get(key) ?? { fields: 0, templateNames: [] };
    u.fields += 1;
    if (!u.templateNames.includes(templateName)) u.templateNames.push(templateName);
    map.set(key, u);
  };
  const styleColor = new Map(
    (kit?.typeStyles ?? []).filter((s) => s.colorKey).map((s) => [s.key, s.colorKey!]),
  );
  for (const t of templates ?? []) {
    for (const f of t.fields) {
      if (!f.typeStyleKey) continue;
      add(styleUse, f.typeStyleKey, t.name);
      const ck = styleColor.get(f.typeStyleKey);
      if (ck) add(colorUse, ck, t.name);
    }
  }
  return { templates, styleUse, colorUse };
}

/** What an edit to a bound style or color reaches, phrased for the undo
 * toast. Autosave replaced the old blocking confirmation, so the blast
 * radius has to travel WITH the change rather than gate it — the sentence
 * says what just happened and the toast's Undo puts it back. Returns null
 * when nothing downstream moves (or usage is still unknown), and the caller
 * falls back to its plain message. */
export function propagationNote(affected: (BindingUsage | undefined)[]): string | null {
  const real = affected.filter((u): u is BindingUsage => !!u && u.fields > 0);
  if (!real.length) return null;
  const fields = real.reduce((n, u) => n + u.fields, 0);
  const templates = new Set(real.flatMap((u) => u.templateNames)).size;
  return `Restyled ${fields} field${fields === 1 ? "" : "s"} in ${templates} template${templates === 1 ? "" : "s"}`;
}
