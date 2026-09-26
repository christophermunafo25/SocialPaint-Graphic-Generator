import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  isAssistantTurn,
  isUserTurn,
  type AssistantTurn,
  type ChatDraft,
  type ChatPhoto,
} from "@/lib/generate/chat";
import { DEFAULT_VARIATIONS } from "@/lib/generate/chatReducer";
import { missingFields } from "@/lib/generate/draftDownload";
import { previewValues, turnPhoto } from "@/lib/generate/draftView";
import { deriveTryNext, platformsAskedFor, type TryNextAction } from "@/lib/generate/tryNext";
import { classifySize, type PlatformId } from "@/lib/templates/platforms";
import { stores } from "@/lib/stores";
import { useAsync } from "@/lib/useAsync";
import { useAuth } from "@/lib/auth/AuthContext";
import { useBrand } from "@/lib/brand/BrandContext";
import { useRouter } from "../../router";
import { useFullViewport } from "../layout/ChromeContext";
import { Page } from "../layout/Page";
import { AssistantTurnView } from "./AssistantTurnView";
import { ChatHeader } from "./ChatHeader";
import { Composer } from "./Composer";
import { EditorPanel, ExportErrorToast, type EditorSaveToLibrary } from "./EditorPanel";
import { LegalLinks } from "./LegalLinks";
import { ScrollFade, useScrollFades } from "./ScrollFade";
import { ChipRow, SuggestionChip } from "./SuggestionChip";
import { UserMessage } from "./UserMessage";
import { requestComposerFocus, takeComposerFocus } from "./composerFocus";
import { useChatController } from "./useChatController";
import { useDraftDownload } from "./useDraftDownload";
import { useThreadScroll } from "./useThreadScroll";

/** The Start state's composer placeholder (PROMPT §7.9). */
const START_PLACEHOLDER = "Describe the post. Add any dates, names, or links it needs.";
/** The thread's composer placeholder. */
const THREAD_PLACEHOLDER = "Ask for changes or describe a new post";
/** The placeholder while a Start from chip is pinned (proposed copy). */
const pinnedPlaceholder = (templateName: string) =>
  `Describe your ${templateName} post. Add any dates, names, or links it needs.`;

/** How many Start from chips the row offers (PROMPT §9.7). */
const MAX_STARTERS = 5;

/** Every turn but the last shows no Try next row: one list for all of
 * them, so their props hold still across runs. */
const NO_ACTIONS: readonly TryNextAction[] = [];

/** Below this viewport width the editor lays over the chat as a sheet
 * instead of narrowing it (PROMPT §8.5, §15 item 16). */
const EDITOR_INLINE_MIN = 1180;

/** How long a card download's failure toast stays up (TemplateFill's). */
const EXPORT_TOAST_MS = 6000;

/** Whether the viewport is at least `px` wide, following resizes. */
function useMinWidth(px: number): boolean {
  const query = `(min-width: ${px}px)`;
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches);
}

/** The editor panel, while it is open (PROMPT §8.5): the turn it edits,
 * the draft it shows and exports, a counter that is new on every open
 * (it keys the panel, so each open mounts it afresh: focus lands on the
 * first field, and a library draft's renderer records the fill page's
 * open), and the field a Try next chip, or a card's Download with a field
 * left to fill, asked it to focus. */
interface EditorState {
  turnId: string;
  draftId: string;
  openId: number;
  focus: { draftId: string; fieldKey: string; nonce: number } | null;
}

/** Save to library's progress for one freestyle draft (PROMPT §8.5). */
type SaveState =
  { state: "busy" } | { state: "saved"; templateId: string } | { state: "error"; error: string };

/**
 * Generate, the chat (docs/design/generate-chat/PROMPT.md; Figma
 * "Generate · Chat", frames 01 to 06). A member describes a post and gets
 * editable, pre-filled graphics back, then keeps talking: a follow-up
 * revises the drafts, a Try next chip makes another size or layout.
 *
 * Three states, one page:
 *
 *  - Start (no message yet): the normal document page. A centred 760
 *    column holds the greeting, the Large composer (Attach, the platform
 *    select, the Variations stepper, Send) and the Start from chips, which
 *    pin one of the company's published templates for the next send
 *    (§9.7). The legal links sit at the foot of the page.
 *  - Thread (a message sent): the route takes the whole viewport
 *    (useFullViewport), a column of the page header (breadcrumb with the
 *    chat's title, History, New chat), the thread as the only scrolling
 *    region, and the dock: the Compact composer over the footnote row. The
 *    thread is a log of user messages and assistant turns, 24 apart in a
 *    760 column anchored to the bottom (short threads sit on the dock, as
 *    chats do); it follows new content while the member is at the latest
 *    turn, never scrolling that turn's head (status and progress) under
 *    the top scroll fade, which appears once the thread has scrolled.
 *  - Edit (frame 06, §8.5): a draft's preview, or Try next's fill chip,
 *    opens the editor panel on that turn. Under the header the chat column
 *    (its thread and dock, now as wide as the column) and the 380 panel
 *    share a row, 24 apart, every draft card goes Compact and the edited
 *    one is outlined. Below 1180px the panel lays over the chat as a sheet
 *    on a scrim instead. Edits go through the controller, one call per
 *    linked group, so the cards, the caption and the panel's live preview
 *    all repaint from the thread. The panel closes on Close, Escape or the
 *    scrim, handing focus back to the preview that opened it, and on its
 *    own when its turn's drafts go (New chat, a retry replacing the turn).
 *    Opening or closing it never moves the thread off what the member was
 *    looking at.
 *
 * A card's Download exports its draft straight through the one export
 * path (useDraftDownload's off-screen renderer, §9.6), painted exactly as
 * the card shows it; a failure shows TemplateFill's toast. A draft with a
 * required field still empty opens the editor on that field instead, as
 * the fill page withholds its Download until every one is filled.
 *
 * Everything that happens to the thread goes through useChatController
 * (the run pipeline, stop, retry, follow-ups) and its pure reducer; this
 * page owns only what outlives no run: the composer's text, photo and
 * toolbar choices, the pinned chip, which caption each turn shows, the
 * editor (which draft, what opened it), Save to library's progress per
 * draft, and the card downloads.
 *
 * The member's photo never leaves the browser: the composer hands it here
 * as a data URL, the send snapshots it onto the message, and only its flag
 * and aspect reach the server. Freestyle runs when the library is empty
 * (the mode toggle is gone, §4) or from "Try another layout".
 *
 * The dev backend has no Edge Functions and no model key, so the Start
 * state keeps today's honest empty state under the greeting there.
 *
 * `threadId` names a saved chat (/generate/c/<id>). Chats are not saved
 * yet (§9.8), so every chat page opens as a new chat; App keys the page on
 * it (and on the workspace), so a different chat always mounts fresh.
 * Every new chat shares one key, so a navigation to /generate from inside
 * a chat (the sidebar's Generate) reaches this page as a fresh route
 * object instead, and starts a new chat in place.
 */
export function GeneratePage({
  templateIdHint,
}: {
  /** "Use this one" from a template card: pins its Start from chip. */
  templateIdHint?: string;
  threadId?: string;
}) {
  const { company, role } = useAuth();
  const { kit } = useBrand();
  const { route, navigate } = useRouter();
  const configured = stores.generate.isConfigured();

  const publishedState = useAsync(
    () => (company ? stores.templates.listPublished(company.id) : Promise.resolve([])),
    [company],
  );
  const published = publishedState.status === "ready" ? publishedState.data : null;
  // With no published templates the library has nothing to fill, but
  // freestyle still works from the brand kit: every run goes freestyle and
  // the Start state says why.
  const libraryEmpty = published !== null && published.length === 0;

  const { thread, running, full, send, runTryNext, stop, retry, editValues, reset } =
    useChatController({
      companyId: company?.id ?? null,
      kit,
      libraryEmpty,
      published,
    });
  const inThread = thread.turns.length > 0;
  useFullViewport(inThread);

  // ── The composer ────────────────────────────────────────────────────────
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<ChatPhoto | null>(null);
  const [platform, setPlatform] = useState<PlatformId | null>(null);
  const [variations, setVariations] = useState(DEFAULT_VARIATIONS);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  // "New chat", a chat opened from History, and a first send (whose Large
  // composer gives way to the dock's) each land focus in the composer
  // (§9.10). Checked after every render: the request can come from before
  // this page mounted.
  useEffect(() => {
    if (takeComposerFocus()) composerRef.current?.focus();
  });

  // ── Start from (§9.7) ──────────────────────────────────────────────────
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  // The route's hint pins its chip once, when the library confirms it is
  // still published (a stale hint degrades to a library-wide generate).
  // Once the member unpins it or sends, it stays unpinned.
  const appliedHint = useRef<string | null>(null);
  useEffect(() => {
    if (!templateIdHint || !published || appliedHint.current === templateIdHint) return;
    appliedHint.current = templateIdHint;
    if (published.some((t) => t.id === templateIdHint)) setPinnedId(templateIdHint);
  }, [templateIdHint, published]);

  // The most recently updated published templates, the hinted one first.
  const starters = useMemo(() => {
    if (!published) return [];
    const recent = [...published].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    const hinted = templateIdHint ? recent.find((t) => t.id === templateIdHint) : undefined;
    return (hinted ? [hinted, ...recent.filter((t) => t !== hinted)] : recent).slice(
      0,
      MAX_STARTERS,
    );
  }, [published, templateIdHint]);
  const pinned = (pinnedId && published?.find((t) => t.id === pinnedId)) || null;

  // Platforms the published library covers, by each template's canvas size
  // (the catalogue's classification). Uncovered ones stay pickable but dim:
  // the hint is a preference, and the server falls back to the whole
  // library with a warning when nothing matches.
  const covered = useMemo(() => {
    const set = new Set<PlatformId>();
    for (const t of published ?? []) {
      for (const p of classifySize(t.canvasWidth, t.canvasHeight).platforms) set.add(p);
    }
    return set;
  }, [published]);

  // ── The thread ─────────────────────────────────────────────────────────
  const { scrollRef, columnRef, columnWidth, follow, preserve } = useThreadScroll(inThread);
  const fades = useScrollFades(scrollRef);
  // The thread as of the last render, for callbacks that stay stable (the
  // turns are memoized on them) but act on the current drafts.
  const threadRef = useRef(thread);
  threadRef.current = thread;
  const titleId = useId();
  // Which draft's caption each turn shows, by turn id.
  const [captionPicks, setCaptionPicks] = useState<Record<string, string>>({});
  // The editor panel, while it is open.
  const [editor, setEditor] = useState<EditorState | null>(null);
  const paletteSize = kit?.colors.length ?? 0;
  const lastTurn = thread.turns[thread.turns.length - 1];

  // Try next (§9.4) for the thread's last turn, once it is done, while
  // nothing runs and the chat can take another message. A platform the
  // chat has already asked for, and had answered, is not offered again.
  const tryNext = useMemo(() => {
    if (!lastTurn || !isAssistantTurn(lastTurn) || running || full) return NO_ACTIONS;
    return deriveTryNext(lastTurn, {
      paletteSize,
      askedPlatforms: platformsAskedFor(thread.turns),
    });
  }, [lastTurn, running, full, paletteSize, thread.turns]);

  const submit = () => {
    const fromStart = !inThread;
    const started = fromStart
      ? send({
          text,
          photo,
          platformHint: platform,
          variations,
          templateIdHint: pinned?.id,
        })
      : // The compact composer has no platform or count: the controller
        // reuses the thread's last composer send (never a chip's).
        send({ text, photo });
    if (!started) return;
    // The photo is snapshotted on the message; the composer starts clean.
    setText("");
    setPhoto(null);
    follow();
    if (fromStart) {
      // A pinned template is for one send.
      setPinnedId(null);
      // The Large composer leaves with the Start state; the member keeps
      // typing in the dock's.
      if (composerRef.current?.form?.contains(document.activeElement)) requestComposerFocus();
    }
  };

  /** Empties the chat in place: stops a run in flight, clears the thread
   * and the composer, and asks for focus in the composer. */
  const clearChat = useCallback(() => {
    reset();
    setText("");
    setPhoto(null);
    setPlatform(null);
    setVariations(DEFAULT_VARIATIONS);
    setPinnedId(null);
    setCaptionPicks({});
    setEditor(null);
    requestComposerFocus();
  }, [reset]);

  /** New chat (§11.2): clears the chat and lands on /generate. The page
   * stays mounted when the URL was already a new chat's. */
  const startNewChat = useCallback(() => {
    clearChat();
    navigate({ name: "generate" });
  }, [clearChat, navigate]);

  // The sidebar's Generate from inside a chat at /generate: the router
  // hands over a fresh route object for the same address, and App keeps
  // this page mounted (every new chat has the one key), so the page starts
  // the new chat itself, as the breadcrumb does. New chat's own navigation
  // lands here too, on a thread it has already emptied.
  const seenRoute = useRef(route);
  useEffect(() => {
    if (route === seenRoute.current) return;
    seenRoute.current = route;
    if (route.name === "generate" && !route.threadId && inThread) clearChat();
  }, [route, inThread, clearChat]);

  const openHistory = useCallback(() => {
    setEditor(null);
    navigate({ name: "generateHistory" });
  }, [navigate]);

  const onCaptionSelect = useCallback(
    (turnId: string, draftId: string) => setCaptionPicks((p) => ({ ...p, [turnId]: draftId })),
    [],
  );

  // ── The editor (frame 06, §8.5, §9.5) ──────────────────────────────────
  // It opens on a draft from its preview's Edit overlay, and on one field
  // from the Try next row's fill chip (§9.4 rule 1).
  const inline = useMinWidth(EDITOR_INLINE_MIN);
  // Each draft's preview button, by draft id (the turns register them):
  // what focus goes back to when the panel closes.
  const previews = useRef(new Map<string, HTMLButtonElement>());
  const registerPreview = useCallback((draftId: string, el: HTMLButtonElement | null) => {
    if (el) previews.current.set(draftId, el);
    else previews.current.delete(draftId);
  }, []);
  // What opened the panel (the preview, or the chip) and the draft it was
  // opened on, whose preview stands in when the chip has gone by the time
  // the panel closes (its field got filled).
  const opener = useRef<{ el: HTMLElement | null; draftId: string } | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const openCount = useRef(0);

  // The panel is open while its turn is in the thread with a draft it can
  // edit. New chat, History and a retry that replaces the turn take the
  // drafts away, and the panel with them.
  const editorTurn = useMemo((): AssistantTurn | null => {
    if (!editor) return null;
    const turn = thread.turns.find((t) => t.id === editor.turnId);
    return turn && isAssistantTurn(turn) && turn.drafts.some((d) => d.schema) ? turn : null;
  }, [editor, thread.turns]);
  const editorOpen = editorTurn !== null;
  const editorOpenRef = useRef(editorOpen);
  editorOpenRef.current = editorOpen;
  const selectedDraft: ChatDraft | null = editorTurn
    ? (editorTurn.drafts.find((d) => d.id === editor?.draftId && d.schema) ??
      editorTurn.drafts.find((d) => d.schema) ??
      null)
    : null;
  const sheet = editorOpen && !inline;

  useEffect(() => {
    if (editor && !editorTurn) {
      opener.current = null;
      setEditor(null);
    }
  }, [editor, editorTurn]);

  /** Opens the panel on `draftId` of `turnId`, or moves it there. A fresh
   * open mounts the panel anew (focus on the first field, or on `focus`'s).
   * On the turn already open it is the same visit: the panel stays mounted,
   * picks `draftId` as its size switch would (a preview's click records no
   * second open), and moves focus only when `focus` asks. The layout change
   * leaves `anchor` where it is on screen. */
  const openEditor = useCallback(
    (
      turnId: string,
      draftId: string,
      from: HTMLElement | null,
      anchor: Element | null,
      focus: EditorState["focus"],
    ) => {
      if (!editorOpenRef.current) preserve(anchor);
      opener.current = { el: from, draftId };
      const openId = ++openCount.current;
      setEditor((current) =>
        current && current.turnId === turnId
          ? { ...current, draftId, focus: focus ?? current.focus }
          : { turnId, draftId, openId, focus },
      );
    },
    [preserve],
  );

  const openDraftEditor = useCallback(
    (turnId: string, draftId: string) => {
      const preview = previews.current.get(draftId) ?? null;
      openEditor(turnId, draftId, preview, preview?.closest(".sp-chat-draft") ?? null, null);
    },
    [openEditor],
  );

  const openDraftField = useCallback(
    (action: Extract<TryNextAction, { kind: "fillField" }>) => {
      // The chip names the first draft, in form order, that has the field;
      // the panel finds the field's linked group from it (findGroupForField).
      const turn = threadRef.current.turns.find(
        (t) => isAssistantTurn(t) && t.drafts.some((d) => d.id === action.draftId),
      );
      if (!turn) return;
      const active = document.activeElement;
      const chip =
        active instanceof HTMLElement && scrollRef.current?.contains(active) ? active : null;
      const preview = previews.current.get(action.draftId) ?? null;
      openEditor(turn.id, action.draftId, chip ?? preview, chip ?? preview, {
        draftId: action.draftId,
        fieldKey: action.fieldKey,
        nonce: ++openCount.current,
      });
    },
    [openEditor, scrollRef],
  );

  /** Close, Escape or the scrim: the panel goes, the thread keeps what the
   * member was looking at, and focus goes back to what opened it. */
  const closeEditor = useCallback(() => {
    const from = opener.current;
    const target =
      (from?.el?.isConnected ? from.el : null) ??
      (from ? previews.current.get(from.draftId) : undefined) ??
      null;
    preserve(target?.closest(".sp-chat-draft") ?? target);
    returnFocus.current = target;
    opener.current = null;
    setEditor(null);
  }, [preserve]);

  // Focus after the panel goes: back to its opener, or, when the panel went
  // with focus in it and nothing to go back to, to the composer.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (editorOpen) {
      wasOpen.current = true;
      return;
    }
    if (!wasOpen.current) return;
    wasOpen.current = false;
    const target = returnFocus.current;
    returnFocus.current = null;
    if (target?.isConnected) target.focus({ preventScroll: true });
    else if (!document.activeElement || document.activeElement === document.body) {
      composerRef.current?.focus({ preventScroll: true });
    }
  }, [editorOpen]);

  // The sheet is modal (aria-modal): everything outside it goes inert while
  // it is up, which is the page's header and chat column under the scrim,
  // and the app's own chrome beside the page (the sidebar, or below 1024px
  // the top bar the sheet starts under, whose menu would otherwise open
  // over it). The chrome is found as the app shell's children that do not
  // hold the page, and found again if the shell swaps them (the sidebar
  // becomes the top bar as the window narrows). Dialogs opened from the
  // sheet portal to <body>, outside the shell, and stay live. The panel
  // keeps Tab inside itself too.
  const headerRef = useRef<HTMLElement | null>(null);
  const chatRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!sheet) return;
    const page = chatRef.current;
    const shell = page?.closest(".sp-appshell") ?? null;
    const made = new Set<HTMLElement>();
    const apply = () => {
      const chrome = shell
        ? Array.from(shell.children).filter((el) => !page || !el.contains(page))
        : [];
      for (const el of [headerRef.current, chatRef.current, ...chrome]) {
        if (el instanceof HTMLElement && !el.inert) {
          el.inert = true;
          made.add(el);
        }
      }
    };
    apply();
    const swaps = shell ? new MutationObserver(apply) : null;
    if (shell) swaps?.observe(shell, { childList: true });
    return () => {
      swaps?.disconnect();
      for (const el of made) el.inert = false;
    };
  }, [sheet]);

  const selectDraft = useCallback(
    (draftId: string) => setEditor((current) => current && { ...current, draftId }),
    [],
  );
  const editorTurnId = editorTurn?.id ?? null;
  const editDrafts = useCallback(
    (edits: Array<{ draftId: string; fieldKey: string; value: string }>) => {
      if (editorTurnId) editValues(editorTurnId, edits);
    },
    [editValues, editorTurnId],
  );

  // ── Save to library (freestyle drafts, admins; §8.5, §15 item 10) ──────
  // The one-shot page's behaviour: the design publishes through the
  // ordinary template store (Brand Templates for everyone, the Template
  // Builder for the marketing team), provenance stamped; the store mints
  // the real identity and the ephemeral one is stripped. Once per draft.
  const [saves, setSaves] = useState<Record<string, SaveState>>({});
  const savesRef = useRef(saves);
  savesRef.current = saves;
  const saveDraft = useCallback(async (draft: ChatDraft) => {
    const current = savesRef.current[draft.id];
    if (!draft.schema || current?.state === "busy" || current?.state === "saved") return;
    const put = (next: SaveState) => setSaves((all) => ({ ...all, [draft.id]: next }));
    put({ state: "busy" });
    try {
      const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = draft.schema;
      const created = await stores.templates.create({ ...rest, status: "published" });
      put({ state: "saved", templateId: created.id });
    } catch (e) {
      put({ state: "error", error: e instanceof Error ? e.message : "Saving failed. Try again." });
    }
  }, []);
  const saveState = selectedDraft ? saves[selectedDraft.id] : undefined;
  const saveToLibrary: EditorSaveToLibrary | null =
    selectedDraft?.schema && selectedDraft.proposal.design && role === "admin"
      ? {
          state: saveState?.state ?? "idle",
          ...(saveState?.state === "error" ? { error: saveState.error } : {}),
          onSave: () => void saveDraft(selectedDraft),
          onOpenBuilder: () => {
            if (saveState?.state === "saved") {
              navigate({ name: "builder", templateId: saveState.templateId });
            }
          },
        }
      : null;

  // ── Card downloads (§9.6) ──────────────────────────────────────────────
  // A card's Download renders its draft off-screen through the one export
  // path, painted exactly as the card shows it (the turn's photo in its
  // slot). A failure shows TemplateFill's toast: the panel's while it is
  // open, the page's otherwise.
  const {
    download,
    busyId,
    error: downloadError,
    clearError: clearDownloadError,
    stage: downloadStage,
  } = useDraftDownload();
  // A draft with a required field still empty (an image slot the photo does
  // not fill, a line a design left for the member) is not exported: the
  // fill page never makes that PNG, and it would carry the renderer's
  // empty-slot box or placeholder copy. Download opens the editor on the
  // draft instead, focused on the first gap (text before images, as the
  // panel lists them), where Download PNG says what is left to fill.
  const downloadDraft = useCallback(
    (turnId: string, draftId: string) => {
      const current = threadRef.current;
      const turn = current.turns.find((t) => t.id === turnId);
      if (!turn || !isAssistantTurn(turn)) return;
      const draft = turn.drafts.find((d) => d.id === draftId);
      if (!draft) return;
      const values = previewValues(draft, turnPhoto(current, turn));
      const missing = missingFields(draft, values);
      if (missing.length === 0) {
        void download(draft, values);
        return;
      }
      const gap = missing.find((f) => f.type !== "image") ?? missing[0];
      const preview = previews.current.get(draftId) ?? null;
      const card = preview?.closest(".sp-chat-draft") ?? null;
      const active = document.activeElement;
      const from = active instanceof HTMLElement && card?.contains(active) ? active : preview;
      openEditor(turnId, draftId, from, card, {
        draftId,
        fieldKey: gap.fieldKey,
        nonce: ++openCount.current,
      });
    },
    [download, openEditor],
  );
  useEffect(() => {
    if (!downloadError) return;
    const timer = window.setTimeout(clearDownloadError, EXPORT_TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [downloadError, clearDownloadError]);

  /** A Try next chip or Try again that starts a run goes with it (the row
   * hides while a run is in flight, a retried turn is replaced, an older
   * turn's Try again is disabled), so focus on it would fall to the page's
   * body. It moves to the dock's composer instead, where a send leaves it
   * (§9.4: a chip that runs the model behaves like sending a message).
   * Only focus that was there to lose is moved, so a click that never
   * focused its button (Safari) leaves focus where it was. */
  const keepFocusInChat = useCallback(() => {
    if (!scrollRef.current?.contains(document.activeElement)) return;
    requestAnimationFrame(() => {
      const active = document.activeElement;
      const lost =
        !active || active === document.body || (active as HTMLButtonElement).disabled === true;
      if (lost) composerRef.current?.focus({ preventScroll: true });
    });
  }, [scrollRef]);

  const onTryNext = useCallback(
    (action: TryNextAction) => {
      if (action.kind === "fillField") {
        openDraftField(action);
        return;
      }
      // A chip that runs the model is a message: its label is the bubble.
      follow();
      keepFocusInChat();
      runTryNext(action);
    },
    [follow, keepFocusInChat, openDraftField, runTryNext],
  );

  const onRetry = useCallback(
    (turnId: string) => {
      follow();
      keepFocusInChat();
      retry(turnId);
    },
    [follow, keepFocusInChat, retry],
  );

  // The export stage and the failure toast sit beside whichever state is
  // showing, at one place in the tree, so a download in flight survives
  // New chat (the stage portals itself to <body>).
  const exportExtras = (
    <>
      {downloadStage}
      {!editorOpen && downloadError && <ExportErrorToast detail={downloadError} />}
    </>
  );

  // ── Start state (frames 01 to 03) ──────────────────────────────────────
  if (!inThread) {
    return (
      <>
        {exportExtras}
        <Page layout={{ className: "sp-chat-page", state: "start" }}>
          <div className="sp-chat-start">
            <div className="sp-chat-start__column">
              <div className="sp-chat-start__greeting">
                <h1 className="sp-chat-start__title">What are we painting today?</h1>
                <p className="sp-chat-start__sub">
                  Describe it and I'll build it from your templates, already on brand.
                </p>
              </div>

              {configured ? (
                <>
                  <div className="sp-chat-start__composer">
                    <Composer
                      size="large"
                      value={text}
                      onChange={setText}
                      photo={photo}
                      onPhotoChange={setPhoto}
                      running={running}
                      onSubmit={submit}
                      onStop={stop}
                      placeholder={pinned ? pinnedPlaceholder(pinned.name) : START_PLACEHOLDER}
                      platform={platform}
                      onPlatformChange={setPlatform}
                      covered={published ? covered : null}
                      dimUncovered={published !== null && !libraryEmpty}
                      variations={variations}
                      onVariationsChange={setVariations}
                      textareaRef={composerRef}
                    />
                  </div>
                  {libraryEmpty && (
                    <p className="sp-chat-start__note">
                      No published templates yet, so drafts come fresh from your brand kit.
                    </p>
                  )}
                  {starters.length > 0 && (
                    <div className="sp-chat-start__starters">
                      <ChipRow label="Start from" align="center">
                        {starters.map((t) => (
                          <SuggestionChip
                            key={t.id}
                            label={t.name}
                            pressed={t.id === pinned?.id}
                            onClick={() => setPinnedId((id) => (id === t.id ? null : t.id))}
                          />
                        ))}
                      </ChipRow>
                    </div>
                  )}
                </>
              ) : (
                <div className="sp-emptystate sp-chat-start__unavailable">
                  <p className="sp-emptystate__title">Generate isn't available on this backend</p>
                  <p className="sp-emptystate__body">
                    It needs the Supabase backend and an Anthropic API key (see .env.example). The
                    template library and manual fill work as usual.
                  </p>
                </div>
              )}
            </div>
          </div>
          <footer className="sp-chat-footer">
            <LegalLinks />
          </footer>
        </Page>
      </>
    );
  }

  // ── Thread states (frames 04 to 06) ─────────────────────────────────────
  // One tree whether or not the editor is open, so the thread's scroller
  // and the composer never remount under the member: the chat column
  // (thread and dock) sits in a row with the panel, which the CSS lays out
  // beside it (inline) or over it (sheet).
  const editorPresentation = editorOpen ? (inline ? "inline" : "sheet") : undefined;
  return (
    <>
      {exportExtras}
      <Page layout={{ className: "sp-chat-page", state: "thread" }}>
        <ChatHeader
          ref={headerRef}
          title={thread.title}
          titleId={titleId}
          onNewChat={startNewChat}
          onHistory={openHistory}
        />
        <div className="sp-chat-split" data-editor={editorPresentation}>
          <div ref={chatRef} className="sp-chat-split__chat">
            <div className="sp-chat-thread-frame">
              <div
                ref={scrollRef}
                className="sp-chat-thread"
                role="log"
                aria-live="polite"
                aria-relevant="additions"
                aria-labelledby={titleId}
              >
                <div ref={columnRef} className="sp-chat-thread__column">
                  {thread.turns.map((turn) =>
                    isUserTurn(turn) ? (
                      <UserMessage key={turn.id} text={turn.text} photo={turn.photo?.dataUrl} />
                    ) : (
                      <AssistantTurnView
                        key={turn.id}
                        turn={turn}
                        photo={turnPhoto(thread, turn)}
                        tryNext={turn === lastTurn ? tryNext : NO_ACTIONS}
                        canRetry={
                          turn.phase === "error" && !running && (turn === lastTurn || !full)
                        }
                        cardSize={editorOpen ? "compact" : "regular"}
                        selectedDraftId={
                          turn === editorTurn && selectedDraft ? selectedDraft.id : null
                        }
                        busyDraftId={
                          busyId && turn.drafts.some((d) => d.id === busyId) ? busyId : null
                        }
                        maxWidth={columnWidth}
                        captionDraftId={captionPicks[turn.id]}
                        onCaptionSelect={onCaptionSelect}
                        registerPreview={registerPreview}
                        onEditDraft={openDraftEditor}
                        onDownloadDraft={downloadDraft}
                        onTryNext={onTryNext}
                        onRetry={onRetry}
                      />
                    ),
                  )}
                </div>
              </div>
              <ScrollFade position="top" visible={fades.top} gutter={fades.gutter} />
            </div>
            <div className="sp-chat-dock">
              <div className="sp-chat-dock__composer">
                {full && (
                  <p className="sp-chat-dock__note">
                    This chat is full. Start a new chat to keep going.
                  </p>
                )}
                <Composer
                  size="compact"
                  value={text}
                  onChange={setText}
                  photo={photo}
                  onPhotoChange={setPhoto}
                  running={running}
                  onSubmit={submit}
                  onStop={stop}
                  placeholder={THREAD_PLACEHOLDER}
                  textareaRef={composerRef}
                  disabled={full}
                />
              </div>
              <p className="sp-chat-footnote">
                <span>Every graphic follows your Brand Studio rules.</span>
                <LegalLinks />
              </p>
            </div>
          </div>
          {editor && editorTurn && selectedDraft && editorPresentation && (
            <EditorPanel
              key={editor.openId}
              drafts={editorTurn.drafts}
              photo={turnPhoto(thread, editorTurn)}
              selectedDraftId={selectedDraft.id}
              onSelectDraft={selectDraft}
              onEdit={editDrafts}
              onClose={closeEditor}
              focusRequest={editor.focus}
              presentation={editorPresentation}
              saveToLibrary={saveToLibrary}
              exportError={downloadError}
            />
          )}
        </div>
      </Page>
    </>
  );
}
