import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { isAssistantTurn, isUserTurn, type ChatPhoto } from "@/lib/generate/chat";
import { DEFAULT_VARIATIONS } from "@/lib/generate/chatReducer";
import { turnPhoto } from "@/lib/generate/draftView";
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
import { LegalLinks } from "./LegalLinks";
import { ScrollFade, useScrollFades } from "./ScrollFade";
import { ChipRow, SuggestionChip } from "./SuggestionChip";
import { UserMessage } from "./UserMessage";
import { requestComposerFocus, takeComposerFocus } from "./composerFocus";
import { useChatController } from "./useChatController";
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

/**
 * Generate, the chat (docs/design/generate-chat/PROMPT.md; Figma
 * "Generate · Chat", frames 01 to 05). A member describes a post and gets
 * editable, pre-filled graphics back, then keeps talking: a follow-up
 * revises the drafts, a Try next chip makes another size or layout.
 *
 * Two states, one page:
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
 *
 * Everything that happens to the thread goes through useChatController
 * (the run pipeline, stop, retry, follow-ups) and its pure reducer; this
 * page owns only what outlives no run: the composer's text, photo and
 * toolbar choices, the pinned chip, and which caption each turn shows.
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
  const { company } = useAuth();
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

  const { thread, running, full, send, runTryNext, stop, retry, reset } = useChatController({
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
  const { scrollRef, columnRef, columnWidth, follow } = useThreadScroll(inThread);
  const fades = useScrollFades(scrollRef);
  const titleId = useId();
  // Which draft's caption each turn shows, by turn id.
  const [captionPicks, setCaptionPicks] = useState<Record<string, string>>({});
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

  const openHistory = useCallback(() => navigate({ name: "generateHistory" }), [navigate]);

  const onCaptionSelect = useCallback(
    (turnId: string, draftId: string) => setCaptionPicks((p) => ({ ...p, [turnId]: draftId })),
    [],
  );

  // The editor panel (§8.5) opens on a draft from its preview's Edit
  // overlay, and on one field from the Try next row's fill chip (§9.4
  // rule 1); a card's Download exports its draft directly (§9.6). The
  // panel and the export stage belong to this page and are not on it yet,
  // so these three are inert.
  const openDraftEditor = useCallback((_turnId: string, _draftId: string) => {}, []);
  const openDraftField = useCallback(
    (_action: Extract<TryNextAction, { kind: "fillField" }>) => {},
    [],
  );
  const downloadDraft = useCallback((_turnId: string, _draftId: string) => {}, []);

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

  // ── Start state (frames 01 to 03) ──────────────────────────────────────
  if (!inThread) {
    return (
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
    );
  }

  // ── Thread states (frames 04 and 05) ───────────────────────────────────
  return (
    <Page layout={{ className: "sp-chat-page", state: "thread" }}>
      <ChatHeader
        title={thread.title}
        titleId={titleId}
        onNewChat={startNewChat}
        onHistory={openHistory}
      />
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
                  canRetry={turn.phase === "error" && !running && (turn === lastTurn || !full)}
                  maxWidth={columnWidth}
                  captionDraftId={captionPicks[turn.id]}
                  onCaptionSelect={onCaptionSelect}
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
            <p className="sp-chat-dock__note">This chat is full. Start a new chat to keep going.</p>
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
    </Page>
  );
}
