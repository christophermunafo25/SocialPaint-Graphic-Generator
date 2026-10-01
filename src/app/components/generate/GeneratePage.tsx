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
  type ChatDocument,
  type ChatPhoto,
  type ChatThread,
} from "@/lib/generate/chat";
import { DEFAULT_VARIATIONS, sameEdits } from "@/lib/generate/chatReducer";
import { missingFields } from "@/lib/generate/draftDownload";
import { captionFor, previewValues, tooLongFields, turnPhoto } from "@/lib/generate/draftView";
import { defaultVariant } from "@/lib/templates/variants";
import { detailKindOf } from "@/lib/generate/details";
import {
  PHOTO_ANSWER,
  checkAnswer,
  currentStep,
  interviewIntro,
  interviewMessage,
  interviewSteps,
  interviewTranscript,
  type InterviewAnswers,
} from "@/lib/generate/interview";
import { createCanvasMeasurer } from "@/lib/render/autoFit";
import type { TemplateSchema } from "@/lib/types";
import { threadWritesSettled } from "@/lib/generate/threadSaver";
import { fromStoredThread } from "@/lib/generate/threadStorage";
import { deriveTryNext, platformsAskedFor, type TryNextAction } from "@/lib/generate/tryNext";
import { classifySize, type PlatformId } from "@/lib/templates/platforms";
import { stores } from "@/lib/stores";
import { useAsync } from "@/lib/useAsync";
import { useAuth } from "@/lib/auth/AuthContext";
import { useBrand } from "@/lib/brand/BrandContext";
import { useRouter } from "../../router";
import { useFullViewport } from "../layout/ChromeContext";
import { Page } from "../layout/Page";
import { AssistantTurnView, type TemplateTurnProps } from "./AssistantTurnView";
import { TemplateLinksDialog } from "../admin/TemplateLinksDialog";
import { ChatButton } from "./ChatButton";
import { ChatHeader } from "./ChatHeader";
import { ChatLoading, ChatUnavailable, THREAD_PLACEHOLDER } from "./ChatLoadStates";
import { Composer } from "./Composer";
import {
  EXPORT_TOAST_MS,
  EditorPanel,
  ExportErrorToast,
  type EditorSaveToLibrary,
} from "./EditorPanel";
import { ChatFootnote, LegalLinks } from "./LegalLinks";
import { RecentChats } from "./RecentChats";
import { ScrollFade, useScrollFades } from "./ScrollFade";
import { TemplateRefCard } from "./TemplateRefCard";
import { ChipRow, SuggestionChip } from "./SuggestionChip";
import { UserMessage } from "./UserMessage";
import { InterviewLive, InterviewTranscript } from "./InterviewView";
import { requestComposerFocus, requestHistoryFocus, takeComposerFocus } from "./composerFocus";
import { useChatController } from "./useChatController";
import { useDraftDownload } from "./useDraftDownload";
import { useThreadPersistence } from "./useThreadPersistence";
import { useThreadScroll } from "./useThreadScroll";

/** The Start state's composer placeholder (PROMPT §7.9). */
const START_PLACEHOLDER = "Describe the post. Add any dates, names, or links it needs.";
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

/** The longest the Start column waits, hidden, for the rows under the
 * composer before it shows anyway. */
const START_REVEAL_MS = 400;

/** Under the first message of a reopened chat that had a photo (PROMPT
 * §9.8, proposed copy): photos are never saved. */
const PHOTO_NOT_SAVED = "Photos aren't saved with chats. Attach it again to use it in a new draft.";
/** A template chat's placeholders (template-chat PROMPT §15). */
const TEMPLATE_ANSWER_PLACEHOLDER = "Type your answer";
const TEMPLATE_PHOTO_PLACEHOLDER = "Attach a photo with the plus";
const TEMPLATE_THREAD_PLACEHOLDER = "Anything to add while the paint's still wet?";

/** Under the composer until a save succeeds (PROMPT §9.8, proposed copy). */
const NOT_SAVED_YET = "This chat isn't saved yet.";

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
  /** The turn's drafts as they were when the panel opened: what "Edited"
   * compares against, and what Discard puts back (template-chat §12.7). */
  snapshot: ChatDraft[];
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
 * Chats save themselves (§9.8, useThreadPersistence): the first time a
 * turn finishes, again as each later one does, and 800ms after the last
 * edit, never while a run is in flight. The first save gives the chat its
 * address: the page replaces /generate with /generate/c/<id> in place, and
 * App keeps it mounted through that (generatePageKey), so the photo and
 * everything else on screen stay. A save that fails leaves the chat as it
 * is and says "This chat isn't saved yet." under the composer until one
 * succeeds. The Start state lists the member's four most recent chats
 * (RecentChats) under the Start from row; a card opens its chat, and View
 * all opens History. The Start column shows once both rows have settled
 * (400ms at most), so neither lifts the centred composer as it lands.
 *
 * A reopened chat (SavedChat, below) arrives as `initial`, its drafts'
 * templates fetched again and nothing of its photos but the note under the
 * first message that had one.
 */
export function GenerateChat({
  templateIdHint,
  initial,
  template = null,
}: {
  /** "Use this one" from a template card: pins its Start from chip. */
  templateIdHint?: string;
  /** A saved chat to continue; null for a new chat. */
  initial: ChatThread | null;
  /** A template chat (template-chat PROMPT §12): the published template the
   * whole thread is scoped to. Null for a Generate chat. */
  template?: TemplateSchema | null;
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
  const libraryEmpty = !template && published !== null && published.length === 0;

  // ── Saving (§9.8) ──────────────────────────────────────────────────────
  // The saver sees every transition of the thread (the controller's
  // onChange). The first save of a new chat names it and moves the page to
  // the chat's address in place: the route is marked savedInPlace, which
  // keeps App's key for this page (generatePageKey), so nothing remounts.
  const onFirstSave = useRef<(id: string) => void>(() => {});
  const { observe, unsaved } = useThreadPersistence({
    companyId: company?.id ?? null,
    initialId: initial?.id ?? null,
    onCreated: (id) => onFirstSave.current(id),
  });

  const templateRef = useMemo(
    () => (template ? { id: template.id, name: template.name } : null),
    [template],
  );
  const {
    thread,
    running,
    full,
    send,
    runTryNext,
    stop,
    retry,
    editValues,
    changeLook,
    editCaption,
    restoreDrafts,
    reset,
    assignId,
  } = useChatController({
    companyId: company?.id ?? null,
    kit,
    libraryEmpty,
    published,
    initial,
    onChange: observe,
    template: templateRef,
  });
  onFirstSave.current = (id) => {
    assignId(id);
    // An Edit details already open keeps its address (edit, field).
    const editing = route.name === "templateChat" ? { edit: route.edit, field: route.field } : {};
    navigate(
      template
        ? {
            name: "templateChat",
            templateId: template.id,
            threadId: id,
            savedInPlace: true,
            ...editing,
          }
        : { name: "generate", threadId: id, savedInPlace: true },
      { replace: true },
    );
  };
  const inThread = thread.turns.length > 0;
  // A template chat opens straight into its questions, laid out as a thread.
  const threadLayout = inThread || Boolean(template);
  useFullViewport(threadLayout);

  // ── The Start column's first paint ─────────────────────────────────────
  // The column is centred in the page, so a row that lands under the
  // composer after it has painted lifts it: Recent (56 + 212) would move the
  // composer 134px up under the member's pointer and caret, and the Start
  // from row 26px. So the column waits, hidden, until both rows are settled
  // (the published templates are in, and Recent has its list, its failure
  // or a cached list with chats), or START_REVEAL_MS at the most, then
  // shows once, already in place. It stays shown until the page empties a
  // chat in place (clearChat), whose Start state waits the same way:
  // Recent may have gained the chat just left.
  const [recentSettled, setRecentSettled] = useState(false);
  const onRecentSettled = useCallback(() => setRecentSettled(true), []);
  const [startShown, setStartShown] = useState(false);
  const startReady =
    startShown ||
    inThread ||
    !configured ||
    !company ||
    (publishedState.status !== "loading" && recentSettled);
  useEffect(() => {
    if (startShown) return;
    if (startReady) {
      setStartShown(true);
      return;
    }
    const timer = window.setTimeout(() => setStartShown(true), START_REVEAL_MS);
    return () => window.clearTimeout(timer);
  }, [startShown, startReady]);

  // ── The composer ────────────────────────────────────────────────────────
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<ChatPhoto | null>(null);
  // The document waiting to go with the next message: text read in the
  // browser, sent once with that message and never saved (PROMPT §12.3).
  const [doc, setDoc] = useState<ChatDocument | null>(null);
  const [platform, setPlatform] = useState<PlatformId | null>(null);
  const [variations, setVariations] = useState(DEFAULT_VARIATIONS);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  // Edit details' stage, where the panel renders the draft (§12.7).
  const [stageEl, setStageEl] = useState<HTMLDivElement | null>(null);
  // ── A template chat's questions (interview.ts) ─────────────────────────
  // Asked one at a time before the first build. The answers live here until
  // the last one, when they go as one message: each answer a detail used
  // verbatim, the photo step's answer the message's photo.
  const steps = useMemo(() => (template ? interviewSteps(template) : []), [template]);
  const [answers, setAnswers] = useState<InterviewAnswers>({});
  const [answerError, setAnswerError] = useState<string | null>(null);
  const interviewing = Boolean(template) && !inThread;
  const step = interviewing ? currentStep(steps, answers) : null;

  // "New chat", a chat opened from History, and a first send (whose Large
  // composer gives way to the dock's) each land focus in the composer
  // (§9.10). Checked after every render: the request can come from before
  // this page mounted. A Start column still hidden cannot take focus, so
  // the request waits for it to show.
  useEffect(() => {
    if (startReady && takeComposerFocus()) composerRef.current?.focus();
  });

  // ── Start from (§9.7) ──────────────────────────────────────────────────
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  // The route's hint pins its chip once, when the library confirms it is
  // still published (a stale hint degrades to a library-wide generate).
  // Once the member unpins it or sends, it stays unpinned. The effect that
  // pins it follows the one that empties the chat on a new route (below),
  // so a new chat on a hint's address, reached by back, pins it again.
  const appliedHint = useRef<string | null>(null);

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
  const { scrollRef, columnRef, columnWidth, follow, preserve } = useThreadScroll(threadLayout);
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
  // A template chat's Public link dialog (admins), as the fill page has it.
  const [sharing, setSharing] = useState(false);
  const paletteSize = kit?.colors.length ?? 0;
  // One canvas measurer for the page's "too long" checks (§9.4).
  const measure = useMemo(() => createCanvasMeasurer(), []);
  const lastTurn = thread.turns[thread.turns.length - 1];
  // The first message of a reopened chat that was sent with a photo: the
  // photo was not saved, and the note under it says so (§9.8). A message
  // sent on this page still holds its photo and needs no note.
  const photoNoteId = useMemo(
    () => thread.turns.find((t) => isUserTurn(t) && t.hadPhoto && !t.photo)?.id,
    [thread.turns],
  );

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

  /** Records the answer to the step being asked (null skips it) and moves
   * on; focus stays in the chat box, wherever the answer came from. */
  const answer = useCallback(
    (value: string | null) => {
      if (!step) return;
      setAnswers((a) => ({ ...a, [step.fieldKey]: value }));
      setAnswerError(null);
      setText("");
      follow();
      composerRef.current?.focus();
    },
    [step, follow],
  );
  /** Back to the question before the one being asked. */
  const answerBack = useCallback(() => {
    const i = step ? steps.indexOf(step) : steps.length;
    const prev = steps[i - 1];
    if (!prev) return;
    setAnswers((a) => {
      const next = { ...a };
      delete next[prev.fieldKey];
      return next;
    });
    if (prev.type === "image") setPhoto(null);
    setAnswerError(null);
    composerRef.current?.focus();
  }, [step, steps]);

  /** Sends the answers as the chat's first message (§12.3's send, with the
   * questions' details). */
  const buildFromAnswers = useCallback(() => {
    const message = interviewMessage(steps, answers);
    const started = send({
      text: message.text,
      photo,
      document: doc,
      details: message.details,
      interview: { skipped: message.skipped },
    });
    if (!started) return false;
    setText("");
    setPhoto(null);
    setDoc(null);
    follow();
    if (composerRef.current?.form?.contains(document.activeElement)) requestComposerFocus();
    return true;
  }, [steps, answers, send, photo, doc, follow]);

  // A photo attached while its step is asked (or before it) answers it.
  useEffect(() => {
    if (step?.type === "image" && photo) answer(PHOTO_ANSWER);
  }, [step, photo, answer]);

  // Taking the photo back off the chat box un-answers its step.
  useEffect(() => {
    if (!interviewing || photo) return;
    const answered = steps.find((s) => s.type === "image" && answers[s.fieldKey] === PHOTO_ANSWER);
    if (!answered) return;
    setAnswers((a) => {
      const next = { ...a };
      delete next[answered.fieldKey];
      return next;
    });
  }, [interviewing, photo, steps, answers]);

  // The last answer builds the graphic, once per set of answers: a refused
  // send leaves "Build it" to try again.
  const autoBuilt = useRef<InterviewAnswers | null>(null);
  useEffect(() => {
    if (!interviewing || step || steps.length === 0 || running) return;
    if (autoBuilt.current === answers) return;
    autoBuilt.current = answers;
    buildFromAnswers();
  }, [interviewing, step, steps.length, running, answers, buildFromAnswers]);

  const submit = () => {
    const fromStart = !inThread;
    if (interviewing) {
      if (!step) {
        buildFromAnswers();
        return;
      }
      if (step.type === "image") {
        setAnswerError(
          step.optional
            ? "Attach a photo with the plus, or skip it."
            : "Attach a photo with the plus.",
        );
        return;
      }
      const checked = checkAnswer(step, text);
      if (checked.ok) answer(checked.value);
      else setAnswerError(checked.error);
      return;
    }
    if (template) {
      // A template chat's follow-up: its template, one draft (§12.3).
      const started = send({ text, photo, document: doc });
      if (!started) return;
      setText("");
      setPhoto(null);
      setDoc(null);
      // A message sent from Edit details returns to the thread (§12.7).
      if (editorOpenRef.current) closeEditor();
      follow();
      return;
    }
    const started = fromStart
      ? send({
          text,
          photo,
          document: doc,
          platformHint: platform,
          variations,
          templateIdHint: pinned?.id,
        })
      : // The compact composer has no platform or count: the controller
        // reuses the thread's last composer send (never a chip's).
        send({ text, photo, document: doc });
    if (!started) return;
    // The photo and the document are snapshotted on the message; the
    // composer starts clean.
    setText("");
    setPhoto(null);
    setDoc(null);
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
   * and the composer, and asks for focus in the composer. The Start state
   * it leads to waits, hidden, for its rows like a fresh page's: Recent
   * settles before the first paint from a cached list with chats, and
   * otherwise when the refreshed list lands. */
  const clearChat = useCallback(() => {
    if (threadRef.current.turns.length > 0) {
      setStartShown(false);
      setRecentSettled(false);
    }
    reset();
    setText("");
    setPhoto(null);
    setDoc(null);
    setAnswers({});
    setAnswerError(null);
    autoBuilt.current = null;
    setPlatform(null);
    setVariations(DEFAULT_VARIATIONS);
    setPinnedId(null);
    appliedHint.current = null;
    setCaptionPicks({});
    setEditor(null);
    requestComposerFocus();
  }, [reset]);

  /** New chat (§11.2): clears the chat and lands on /generate. The page
   * stays mounted when the URL was already a new chat's. */
  const startNewChat = useCallback(() => {
    clearChat();
    navigate(template ? { name: "templateChat", templateId: template.id } : { name: "generate" });
  }, [clearChat, navigate, template]);

  /** Brand Templates, from the breadcrumb and "Change template": the chat
   * stays saved in History (§12.4). */
  const openBrandTemplates = useCallback(() => navigate({ name: "portal" }), [navigate]);

  // The sidebar's Generate from inside a chat at /generate: the router
  // hands over a fresh route object for the same address (routeState), and
  // App keeps this page mounted (every new chat has the one key), so the
  // page starts the new chat itself, as the breadcrumb does. New chat's own
  // navigation lands here too, on a thread it has already emptied, and so
  // does back from a chat saved in place to an earlier new chat's address.
  const seenRoute = useRef(route);
  useEffect(() => {
    if (route === seenRoute.current) return;
    seenRoute.current = route;
    if (
      (route.name === "generate" || route.name === "templateChat") &&
      !route.threadId &&
      inThread
    ) {
      clearChat();
    }
  }, [route, inThread, clearChat]);

  // The Start from hint (above), after the effect that empties the chat: an
  // emptied chat forgets the hint it applied, so the route it empties on
  // pins its own hint, as a fresh load of its address does.
  useEffect(() => {
    if (!templateIdHint || !published || appliedHint.current === templateIdHint) return;
    appliedHint.current = templateIdHint;
    if (published.some((t) => t.id === templateIdHint)) setPinnedId(templateIdHint);
  }, [templateIdHint, published]);

  /** History (§11.2). The button that was pressed unmounts with this page,
   * so the History page takes focus on its title (§9.10). */
  const openHistory = useCallback(() => {
    setEditor(null);
    requestHistoryFocus();
    navigate({ name: "generateHistory" });
  }, [navigate]);

  /** A Recent card: the chat opens at its own address, a page of its own,
   * with focus in its composer once it has loaded (§9.10). */
  const openChat = useCallback(
    (threadId: string, templateId: string | null) => {
      requestComposerFocus();
      // A template chat opens on its template's page, which sends it on to
      // /generate/c/<id> when that template has gone (template-chat §12.1).
      navigate(
        templateId
          ? { name: "templateChat", templateId, threadId }
          : { name: "generate", threadId },
      );
    },
    [navigate],
  );

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
      const turn = threadRef.current.turns.find((t) => t.id === turnId);
      const snapshot = turn && isAssistantTurn(turn) ? turn.drafts : [];
      setEditor((current) =>
        current && current.turnId === turnId
          ? { ...current, draftId, focus: focus ?? current.focus }
          : { turnId, draftId, openId, focus, snapshot },
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

  // ── Edit details' address (template chats, §12.7) ──────────────────────
  // Opening Edit details writes `edit` (and `field`) into the URL as a new
  // history entry, so Back returns to the thread; Back to chat goes back
  // through that entry. A URL that arrives with `edit` (a link, a reload,
  // forward) opens it on that draft, focused on `field`.
  const chatRoute = route.name === "templateChat" ? route : null;
  const pushedEdit = useRef(false);
  const editorDraftId = editor && editorTurn ? editor.draftId : null;
  // Only the editor's own opens and closes write the address: on mount the
  // address is what opens the editor (below), never the other way round.
  const lastEditorDraft = useRef(editorDraftId);
  useEffect(() => {
    if (lastEditorDraft.current === editorDraftId) return;
    lastEditorDraft.current = editorDraftId;
    if (!template || !chatRoute) return;
    const want = editorDraftId;
    const have = chatRoute.edit ?? null;
    if (want === have) return;
    if (want) {
      const field = editor?.focus?.fieldKey;
      pushedEdit.current = true;
      navigate({ ...chatRoute, edit: want, ...(field ? { field } : { field: undefined }) });
    } else if (pushedEdit.current) {
      pushedEdit.current = false;
      window.history.back();
    } else {
      navigate({ ...chatRoute, edit: undefined, field: undefined }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs on the editor's own changes
  }, [editorDraftId]);
  useEffect(() => {
    if (!template || !chatRoute) return;
    const edit = chatRoute.edit ?? null;
    if (!edit) {
      // Back past the entry Edit details wrote.
      if (editorDraftId) {
        pushedEdit.current = false;
        closeEditor();
      }
      return;
    }
    if (edit === editorDraftId) return;
    const turn = threadRef.current.turns.find(
      (t) => isAssistantTurn(t) && t.drafts.some((d) => d.id === edit && d.schema),
    );
    if (!turn) return;
    const preview = previews.current.get(edit) ?? null;
    openEditor(
      turn.id,
      edit,
      preview,
      preview,
      chatRoute.field
        ? { draftId: edit, fieldKey: chatRoute.field, nonce: ++openCount.current }
        : null,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- follows the address only
  }, [chatRoute?.edit, chatRoute?.field]);

  // Discard (§12.7): the turn's drafts back as the panel found them.
  const canDiscard = useMemo(() => {
    if (!editor || !editorTurn) return false;
    return editorTurn.drafts.some((d) => {
      const was = editor.snapshot.find((x) => x.id === d.id);
      return was !== undefined && !sameEdits(d, was);
    });
  }, [editor, editorTurn]);
  const discard = useCallback(() => {
    if (editor) restoreDrafts(editor.turnId, editor.snapshot);
  }, [editor, restoreDrafts]);

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
      // A template chat also holds back a value too long for its line at
      // its floor (§9.4, §12.5); the editor says what to shorten.
      const tooLong = templateRef ? tooLongFields(draft, values, kit, measure) : [];
      if (missing.length === 0 && tooLong.length === 0) {
        void download(draft, values);
        return;
      }
      const gap = missing.find((f) => f.type !== "image") ?? missing[0] ?? { fieldKey: tooLong[0] };
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
    [download, openEditor, templateRef, kit, measure],
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

  // ── A template chat's turns (§12.5) ────────────────────────────────────
  // A Fill in tag opens the editor on its field; a look switch is instant.
  // (Edit details replaces the editor here in Phase 5 of the template chat.)
  const onFillIn = useCallback(
    (turnId: string, draftId: string, fieldKey: string) => {
      const active = document.activeElement;
      const tag =
        active instanceof HTMLElement && scrollRef.current?.contains(active) ? active : null;
      const preview = previews.current.get(draftId) ?? null;
      openEditor(turnId, draftId, tag ?? preview, tag ?? preview, {
        draftId,
        fieldKey,
        nonce: ++openCount.current,
      });
    },
    [openEditor, scrollRef],
  );
  const templateTurn = useMemo((): TemplateTurnProps | null => {
    if (!template) return null;
    return {
      lookCount: template.variants?.length ?? 0,
      aspect: template.canvasWidth / template.canvasHeight,
      measure,
      onFillIn,
      onChangeLook: changeLook,
    };
  }, [template, measure, onFillIn, changeLook]);

  // The export stage and the failure toast sit beside whichever state is
  // showing, at one place in the tree, so a download in flight survives
  // New chat (the stage portals itself to <body>).
  const exportExtras = (
    <>
      {downloadStage}
      {!editorOpen && downloadError && <ExportErrorToast detail={downloadError} />}
      {sharing && template && (
        <TemplateLinksDialog template={template} onClose={() => setSharing(false)} />
      )}
    </>
  );

  // ── Start state (frames 01 to 03) ──────────────────────────────────────
  if (!threadLayout) {
    return (
      <>
        {exportExtras}
        <Page layout={{ className: "sp-chat-page", state: "start" }}>
          <div className="sp-chat-start">
            <div className="sp-chat-start__column" data-pending={startReady ? undefined : true}>
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
                      document={doc}
                      onDocumentChange={setDoc}
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
                  {company && (
                    <RecentChats
                      companyId={company.id}
                      onOpen={openChat}
                      onViewAll={openHistory}
                      onSettled={onRecentSettled}
                    />
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
  // Edit details (template chats, §12.7): the thread gives way to the stage,
  // the draft rendered large in its well, with the compact chat box docked
  // under it and the panel beside it (or over it, below 1180px).
  const editView = Boolean(template && editorOpen && selectedDraft);
  const lookOptions = template?.variants?.map((v) => ({ id: v.id, label: v.name })) ?? [];
  return (
    <>
      {exportExtras}
      <Page layout={{ className: "sp-chat-page", state: "thread" }}>
        <ChatHeader
          ref={headerRef}
          // A template chat is named by its template (Brand Templates / Now
          // hiring), as every frame of it draws the header.
          title={editView ? "Edit details" : template ? template.name : thread.title}
          titleId={titleId}
          onNewChat={startNewChat}
          onHistory={openHistory}
          root={
            template
              ? { label: "Brand Templates", route: { name: "portal" }, onClick: openBrandTemplates }
              : undefined
          }
          {...(template && !editView
            ? {
                actions: (
                  <>
                    <ChatButton
                      kind="tertiary"
                      size="small"
                      onClick={() => navigate({ name: "template", templateId: template.id })}
                    >
                      Fill in by hand
                    </ChatButton>
                    {role === "admin" && (
                      <ChatButton
                        kind="tertiary"
                        size="small"
                        onClick={() => navigate({ name: "bulk", templateId: template.id })}
                      >
                        Bulk fill
                      </ChatButton>
                    )}
                    {role === "admin" && (
                      <ChatButton kind="accent" size="small" onClick={() => setSharing(true)}>
                        Public link
                      </ChatButton>
                    )}
                  </>
                ),
              }
            : {})}
          {...(editView && template && chatRoute
            ? {
                middle: {
                  label: template.name,
                  route: { ...chatRoute, edit: undefined, field: undefined },
                  onClick: closeEditor,
                },
                actions: (
                  <ChatButton kind="tertiary" size="small" onClick={closeEditor}>
                    Back to chat
                  </ChatButton>
                ),
              }
            : {})}
        />
        <div
          className="sp-chat-split"
          data-editor={editorPresentation}
          data-view={editView ? "edit" : undefined}
        >
          <div ref={chatRef} className="sp-chat-split__chat">
            {editView && <div ref={setStageEl} className="sp-chat-stage" />}
            <div className="sp-chat-thread-frame" hidden={editView}>
              <div
                ref={scrollRef}
                className="sp-chat-thread"
                // A classic scrollbar's gutter, given back from the side
                // padding so the column keeps its box (the CSS says how).
                style={{ "--thread-scrollbar": `${fades.gutter}px` } as React.CSSProperties}
                role="log"
                aria-live="polite"
                aria-relevant="additions"
                aria-labelledby={titleId}
              >
                <div ref={columnRef} className="sp-chat-thread__column">
                  {template && (
                    <TemplateRefCard template={template} onChange={openBrandTemplates} />
                  )}
                  {interviewing && (
                    <InterviewLive
                      intro={interviewIntro(template?.name ?? "", steps)}
                      answered={steps
                        .filter((s) => s.fieldKey in answers)
                        .map((s) => ({ step: s, answer: answers[s.fieldKey] }))}
                      step={step}
                      photo={photo?.dataUrl}
                      error={answerError}
                      canBack={steps.some((s) => s.fieldKey in answers)}
                      busy={running}
                      onAnswer={answer}
                      onSkip={() => answer(null)}
                      onBack={answerBack}
                      onBuild={buildFromAnswers}
                    />
                  )}
                  {thread.turns.map((turn) =>
                    isUserTurn(turn) && turn.interview && template ? (
                      <InterviewTranscript
                        key={turn.id}
                        intro={interviewIntro(template.name, steps)}
                        pairs={interviewTranscript(steps, {
                          details: turn.details,
                          skipped: turn.interview.skipped,
                          hadPhoto: Boolean(turn.photo || turn.hadPhoto),
                        })}
                        photo={turn.photo?.dataUrl}
                        note={turn.id === photoNoteId ? PHOTO_NOT_SAVED : undefined}
                      />
                    ) : isUserTurn(turn) ? (
                      <UserMessage
                        key={turn.id}
                        text={turn.text}
                        photo={turn.photo?.dataUrl}
                        document={turn.document ?? turn.hadDocument}
                        tags={turn.details?.map((d) => ({ ...d, kind: detailKindOf(d) }))}
                        note={turn.id === photoNoteId ? PHOTO_NOT_SAVED : undefined}
                      />
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
                        template={templateTurn}
                        onFillIn={onFillIn}
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
                  document={doc}
                  onDocumentChange={setDoc}
                  running={running}
                  onSubmit={submit}
                  onStop={stop}
                  placeholder={
                    interviewing
                      ? step?.type === "image"
                        ? TEMPLATE_PHOTO_PLACEHOLDER
                        : (step?.placeholder ?? TEMPLATE_ANSWER_PLACEHOLDER)
                      : template
                        ? TEMPLATE_THREAD_PLACEHOLDER
                        : THREAD_PLACEHOLDER
                  }
                  textareaRef={composerRef}
                  disabled={full}
                />
                {unsaved && <p className="sp-chat-dock__note">{NOT_SAVED_YET}</p>}
              </div>
              <ChatFootnote />
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
              openDrafts={editor.snapshot}
              onDiscard={discard}
              canDiscard={canDiscard}
              {...(editView
                ? {
                    stageTarget: stageEl,
                    looks:
                      lookOptions.length > 1
                        ? {
                            options: lookOptions,
                            selectedId:
                              selectedDraft.variantId ??
                              (template ? defaultVariant(template)?.id : undefined) ??
                              "",
                            onSelect: (id: string) =>
                              changeLook(editorTurn.id, selectedDraft.id, id),
                          }
                        : null,
                    caption: {
                      value: captionFor(selectedDraft, { templateFallback: false }),
                      onChange: (next: string) =>
                        editCaption(editorTurn.id, selectedDraft.id, next),
                    },
                  }
                : {})}
            />
          )}
        </div>
      </Page>
    </>
  );
}

/**
 * Generate, at /generate (a new chat) and /generate/c/<id> (a saved one):
 * the route's page. App keys it per chat (generatePageKey), so a different
 * chat is a different mount and the chat it opened on is read once, at
 * mount. The one address change it sees in place is its own, after it
 * saves a new chat for the first time (§9.8); that chat is already on
 * screen, and reading `threadId` again would load it over itself.
 */
export function GeneratePage({
  templateIdHint,
  threadId,
}: {
  /** "Use this one" from a template card: pins its Start from chip. */
  templateIdHint?: string;
  /** A saved chat to open (/generate/c/<id>). */
  threadId?: string;
}) {
  const [openedId] = useState(threadId ?? null);
  return openedId ? (
    <SavedChat threadId={openedId} />
  ) : (
    <GenerateChat templateIdHint={templateIdHint} initial={null} />
  );
}

/**
 * A saved chat, opened (§9.8): the stored record, then the templates its
 * library drafts fill (a template that has gone, or is no longer
 * published, leaves its draft saying so), freestyle drafts rebuilt from
 * their designs, and no photos. The thread's layout stands in while it
 * loads (ChatLoading). A record that is not there, or not the member's in
 * this workspace, reads as not found; a load that fails says so with Try
 * again (ChatUnavailable). Once loaded, the chat carries on as any other,
 * saving to the same record.
 */
function SavedChat({ threadId }: { threadId: string }) {
  const { company } = useAuth();
  const { navigate } = useRouter();
  const companyId = company?.id ?? null;
  const load = useAsync(async (): Promise<ChatThread | { templateId: string } | null> => {
    if (!companyId) return null;
    // A write of this chat may still be in flight (it was left a moment
    // ago, with an edit to write): read the row it leaves, never the one
    // before it, which the chat's next save would write back over the edit.
    await threadWritesSettled();
    const record = await stores.generateThreads.get(companyId, threadId);
    if (!record) return null;
    // A template chat whose template is still published belongs on its
    // template's page (template-chat §12.1); one whose template has gone
    // stays here, an ordinary Generate chat.
    if (record.templateId) {
      const t = await stores.templates.get(record.templateId);
      if (t && t.status === "published" && t.companyId === companyId) {
        return { templateId: t.id };
      }
    }
    return fromStoredThread(record, {
      companyId,
      getTemplate: (id) => stores.templates.get(id),
    });
  }, [companyId, threadId]);
  const moveTo =
    load.status === "ready" && load.data && "templateId" in load.data && !("turns" in load.data)
      ? load.data.templateId
      : null;
  useEffect(() => {
    if (moveTo) navigate({ name: "templateChat", templateId: moveTo, threadId }, { replace: true });
  }, [moveTo, navigate, threadId]);

  const newChat = useCallback(() => {
    requestComposerFocus();
    navigate({ name: "generate" });
  }, [navigate]);
  const history = useCallback(() => {
    requestHistoryFocus();
    navigate({ name: "generateHistory" });
  }, [navigate]);

  if (load.status === "loading" || moveTo) {
    return <ChatLoading onNewChat={newChat} onHistory={history} />;
  }
  if (load.status === "error") {
    return (
      <ChatUnavailable
        reason="error"
        onRetry={load.retry}
        onNewChat={newChat}
        onHistory={history}
      />
    );
  }
  if (!load.data || !("turns" in load.data)) {
    return <ChatUnavailable reason="missing" onNewChat={newChat} onHistory={history} />;
  }
  return <GenerateChat initial={load.data} />;
}
