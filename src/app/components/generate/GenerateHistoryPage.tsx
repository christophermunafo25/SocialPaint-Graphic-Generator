import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  HISTORY_PAGE_SIZE,
  canLoadMore,
  historyReducer,
  initialHistory,
  isEmptyHistory,
  loadingCount,
  loadingShapes,
  pendingRequest,
  showingChats,
} from "@/lib/generate/historyPaging";
import { chatMeta } from "@/lib/generate/relativeDate";
import { NEW_CHAT_TITLE } from "@/lib/generate/runCopy";
import { threadWritesSettled } from "@/lib/generate/threadSaver";
import type { PlatformFacet } from "@/lib/templates/groups";
import { PLATFORMS, type PlatformId } from "@/lib/templates/platforms";
import { stores } from "@/lib/stores";
import { useAsync } from "@/lib/useAsync";
import { useAuth } from "@/lib/auth/AuthContext";
import { useRouter } from "../../router";
import { ErrorState } from "../ErrorState";
import { useFullViewport } from "../layout/ChromeContext";
import { Page } from "../layout/Page";
import { GroupChips } from "../templates/GroupChips";
import { TemplateSearchField } from "../templates/TemplateSearchField";
import { ChatBreadcrumb } from "./ChatHeader";
import { ChatButton } from "./ChatButton";
import { HistoryCard } from "./HistoryCard";
import { LegalLinks } from "./LegalLinks";
import { ScrollFade, useScrollFades } from "./ScrollFade";
import { NewChatIcon } from "./icons";
import { requestComposerFocus, takeHistoryFocus } from "./composerFocus";
import { useThreadPreviews } from "./useThreadPreviews";

/** The sentinel asks for the next page this far before it scrolls into
 * view (PROMPT §8.6), so the loading row is rarely seen at a reading pace. */
const PREFETCH_MARGIN = "0px 0px 400px 0px";

/** The number of columns the auto-fill grid lays out right now (0 until it
 * is measured), kept current as the window resizes, so the loading cards
 * can finish its last row (loadingCount). A callback ref: the grid mounts
 * and unmounts as the body switches between the list and its states. */
function useGridColumns(): [(el: HTMLDivElement | null) => void, number] {
  const [columns, setColumns] = useState(0);
  const observer = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: HTMLDivElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!el) return;
    const measure = () => {
      const tracks = getComputedStyle(el).gridTemplateColumns.trim();
      setColumns(tracks && tracks !== "none" ? tracks.split(/\s+/).length : 0);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    observer.current = new ResizeObserver(measure);
    observer.current.observe(el);
  }, []);
  return [ref, columns];
}

const LOAD_FAILED = "We couldn't load your chats.";
const NO_CHATS = "No chats yet";
const noMatch = (query: string) => (query ? `No chats match “${query}”.` : "That set is empty.");

/**
 * Every chat the member has started (Figma "Generate · Chat", frame 07;
 * PROMPT §8.6), at /generate/history. A full-height column like the
 * thread: the header (the breadcrumb, the "History" title with New chat on
 * its row, and the description), the filter bar, the grid of chats as the
 * only scrolling region, and the legal links at the foot.
 *
 * The filter bar is the Brand Templates one: the search field ("Search
 * chats", a case-insensitive title search) and the platform chips, one per
 * platform the member's chats use, in PLATFORMS order, after "All chats".
 * The URL is the state, as on Brand Templates: a chip is a navigation, and
 * typing settles into the URL in place (replace) so the back button is not
 * buried under keystrokes. A platform the member's chats never use is no
 * filter, as on Brand Templates; the list waits for the chips to know.
 *
 * The grid is square HistoryCards, newest first, twelve at a time: a
 * sentinel under the grid, watched inside the scroller with 400px to
 * spare, asks for the next page, loading cards hold its place while it
 * comes (a row's worth: four at the frame's four columns, and never a lone
 * card on a row of its own), and a short page ends the list (historyPaging.ts holds the
 * rules). Each load is announced ("Showing 24 chats"). The scroller runs
 * into the page gutters and hands them back as its own padding, so the
 * cards' shadows are never cut at its sides; the top and bottom scroll
 * fades lie over it, beside it in a non-scrolling frame.
 *
 * With no chats at all the body is the empty state, whose New chat is the
 * way in; a filter that matches nothing says so and offers Clear; a failed
 * load is ErrorState with a retry (a later page's failure keeps the chats
 * above it). Opening a chat goes to /generate/c/<id> with focus in its
 * composer, and New chat (here, in the empty state, and the breadcrumb's
 * "Generate") opens a fresh one the same way (§9.10). Arriving from a
 * chat's History or View all puts focus on the title.
 */
export function GenerateHistoryPage() {
  const { company } = useAuth();
  const { route, navigate } = useRouter();
  useFullViewport(true);
  const companyId = company?.id ?? null;

  // ── URL is the source of truth ──────────────────────────────────────────
  const rawQuery = (route.name === "generateHistory" && route.q) || "";
  const query = rawQuery.trim();
  const rawPlatform = route.name === "generateHistory" ? route.platform : undefined;

  const setFilter = (next: { platform?: PlatformId | null; q?: string }, replace = false) =>
    navigate(
      {
        name: "generateHistory",
        platform: (next.platform !== undefined ? next.platform : rawPlatform) ?? undefined,
        q: (next.q !== undefined ? next.q : rawQuery) || undefined,
      },
      { replace },
    );

  // ── The chips: the platforms the member's chats use ─────────────────────
  // Every read here waits for the writes of a chat just left (the chat
  // page's last edit, or the turn it stopped), so that chat and its
  // platforms are in them.
  const inUseState = useAsync(
    () =>
      companyId
        ? threadWritesSettled().then(() => stores.generateThreads.platformsInUse(companyId))
        : Promise.resolve([]),
    [companyId],
  );
  const inUse = inUseState.status === "ready" ? inUseState.data : null;
  // The read failed and has not answered since. It is asked again later
  // (below), and the page stays as the failure left it while it is.
  const [inUseFailed, setInUseFailed] = useState(false);
  useEffect(() => {
    if (inUseState.status !== "loading") setInUseFailed(inUseState.status === "error");
  }, [inUseState.status]);
  const inUseUnknown =
    inUseState.status === "error" || (inUseState.status === "loading" && inUseFailed);

  /** The platform the list is filtered by: none without one in the URL or
   * when the chats never use it; undefined while the chips are still
   * loading and the URL names one. If the chips fail to load, the URL's
   * platform is trusted rather than the list held back. */
  const platform: PlatformId | null | undefined = !rawPlatform
    ? null
    : inUse
      ? inUse.includes(rawPlatform)
        ? rawPlatform
        : null
      : inUseUnknown
        ? rawPlatform
        : undefined;

  // ── The list ────────────────────────────────────────────────────────────
  const filter = platform === undefined ? null : JSON.stringify([companyId, platform, query]);
  const [paging, dispatch] = useReducer(historyReducer, filter ?? "", initialHistory);
  // A new filter shows its own first load from the render it arrives in,
  // never a frame of the old filter's chats; the reducer catches up after.
  const list = filter !== null && paging.filter === filter ? paging : initialHistory(filter ?? "");
  useEffect(() => {
    if (filter !== null) dispatch({ type: "filter", filter });
  }, [filter]);

  // The platforms of the chats this page has listed: the chips while the
  // platforms in use cannot be read (with the URL's), growing as pages
  // land, so the filter never silently goes.
  const [listed, setListed] = useState<{ companyId: string | null; ids: PlatformId[] }>({
    companyId,
    ids: [],
  });
  useEffect(() => {
    setListed((prev) => {
      const ids = new Set(prev.companyId === companyId ? prev.ids : []);
      for (const chat of list.items) for (const p of chat.platforms) ids.add(p);
      return prev.companyId === companyId && ids.size === prev.ids.length
        ? prev
        : { companyId, ids: [...ids] };
    });
  }, [companyId, list.items]);

  const facets = useMemo<PlatformFacet[]>(() => {
    const ids = inUse ?? (inUseUnknown ? [...listed.ids, ...(platform ? [platform] : [])] : []);
    // GroupChips draws no counts; the facet's count is the catalogue's.
    return PLATFORMS.filter((p) => ids.includes(p.id)).map((p) => ({ platform: p, count: 0 }));
  }, [inUse, inUseUnknown, listed, platform]);

  // A failed read of the platforms in use is asked again as a page of
  // chats lands or the filter changes, as the store may be answering again.
  const retryInUse = inUseState.status === "error" ? inUseState.retry : null;
  useEffect(() => {
    retryInUse?.();
    // Only a page landing or a new filter asks, never the failure itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.items.length, filter]);

  const request = pendingRequest(list);
  useEffect(() => {
    if (!companyId || filter === null || !request || request.filter !== filter) return;
    let alive = true;
    threadWritesSettled()
      .then(() =>
        stores.generateThreads.list(companyId, {
          limit: HISTORY_PAGE_SIZE,
          before: request.cursor ?? undefined,
          platform: platform ?? undefined,
          q: query || undefined,
        }),
      )
      .then(
        (page) => {
          if (alive) dispatch({ type: "loaded", request, ...page });
        },
        (e: unknown) => {
          console.error("Load failed", e);
          if (alive) dispatch({ type: "failed", request });
        },
      );
    return () => {
      alive = false;
    };
    // The request is its filter and cursor; the rest is in the filter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, filter, request?.filter, request?.cursor]);

  // ── The scroller: fades, paging, and a fresh top for a new filter ───────
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const fades = useScrollFades(scrollRef);

  useLayoutEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [filter]);

  // A fresh observer each time the list can take another page: its first
  // report reads the layout the last page left, so a page that still does
  // not reach the sentinel's margin (a tall window) asks for the next one,
  // and a page that pushed it out of reach asks for nothing.
  const more = canLoadMore(list);
  useEffect(() => {
    const root = scrollRef.current;
    const target = sentinelRef.current;
    if (!more || !root || !target) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) dispatch({ type: "more" });
      },
      { root, rootMargin: PREFETCH_MARGIN },
    );
    io.observe(target);
    return () => io.disconnect();
  }, [more]);

  const previewFor = useThreadPreviews(companyId, list.items);
  const [gridRef, columns] = useGridColumns();

  // Arriving from a chat's History or View all, whose button unmounted with
  // the chat page: focus lands on the title, so the next Tab reaches New
  // chat, the search and the chips in order (§9.10).
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (takeHistoryFocus()) titleRef.current?.focus({ preventScroll: true });
  }, []);

  // ── Actions ─────────────────────────────────────────────────────────────
  const newChat = useCallback(() => {
    requestComposerFocus();
    navigate({ name: "generate" });
  }, [navigate]);

  // A template chat opens on its template's page (template-chat §12.1).
  const openChat = (id: string, templateId: string | null) => {
    requestComposerFocus();
    navigate(
      templateId
        ? { name: "templateChat", templateId, threadId: id }
        : { name: "generate", threadId: id },
    );
  };

  const retry = () => {
    if (inUseState.status === "error") inUseState.retry();
    dispatch({ type: "retry" });
  };

  // ── What the body shows ─────────────────────────────────────────────────
  const filtered = Boolean(platform || query);
  const empty = isEmptyHistory(list);
  const noChats = empty && !filtered;
  const failed = list.phase === "error";
  const now = new Date();

  const announcement = failed
    ? LOAD_FAILED
    : list.phase === "loading" && list.items.length === 0
      ? ""
      : empty
        ? filtered
          ? noMatch(query)
          : NO_CHATS
        : showingChats(list.items.length);

  let body: React.ReactNode;
  if (noChats) {
    body = (
      <div className="sp-emptystate">
        <p className="sp-emptystate__title">{NO_CHATS}</p>
        <p className="sp-emptystate__body">
          Chats you start in Generate show up here, newest first.
        </p>
        <div className="sp-emptystate__actions">
          <ChatButton kind="secondary" size="small" icon={<NewChatIcon />} onClick={newChat}>
            New chat
          </ChatButton>
        </div>
      </div>
    );
  } else if (empty) {
    body = (
      <div className="sp-emptystate">
        <p className="sp-emptystate__title">{noMatch(query)}</p>
        <div className="sp-emptystate__actions">
          <ChatButton
            kind="tertiary"
            size="small"
            onClick={() => setFilter({ platform: null, q: "" })}
          >
            Clear
          </ChatButton>
        </div>
      </div>
    );
  } else if (failed && list.items.length === 0) {
    body = (
      <ErrorState
        title={LOAD_FAILED}
        detail="Check your connection and try again."
        onRetry={retry}
      />
    );
  } else {
    const loading = list.phase === "loading";
    body = (
      <>
        <div ref={gridRef} className="sp-chat-history-grid" aria-busy={loading || undefined}>
          {list.items.map((chat) => {
            const { preview, aspect } = previewFor(chat);
            return (
              <HistoryCard
                key={chat.id}
                title={chat.title.trim() || NEW_CHAT_TITLE}
                meta={chatMeta(chat.platforms, chat.updatedAt, now)}
                preview={preview}
                aspect={aspect}
                onOpen={() => openChat(chat.id, chat.templateId)}
              />
            );
          })}
          {loading &&
            loadingShapes(list.items.length, loadingCount(list.items.length, columns)).map(
              (shape, i) => (
                <HistoryCard key={`loading-${i}`} state="loading" loadingShape={shape} />
              ),
            )}
        </div>
        {failed && (
          <ErrorState
            title={LOAD_FAILED}
            detail="Check your connection and try again."
            onRetry={retry}
          />
        )}
      </>
    );
  }

  return (
    <Page layout={{ className: "sp-chat-page", state: "history" }}>
      <header className="sp-chat-history-head">
        <ChatBreadcrumb current="History" onRoot={newChat} />
        <div className="sp-chat-history-head__title">
          <h1 ref={titleRef} tabIndex={-1} className="sp-page-title">
            History
          </h1>
          <ChatButton kind="secondary" size="small" icon={<NewChatIcon />} onClick={newChat}>
            New chat
          </ChatButton>
        </div>
        <p className="sp-chat-history-head__desc">
          Every chat and the posts it made, newest first. Open one to pick up where you left off.
        </p>
      </header>

      {!noChats && (
        <div className="sp-filterbar">
          <TemplateSearchField
            value={rawQuery}
            onChange={(q) => setFilter({ q }, true)}
            placeholder="Search chats"
            ariaLabel="Search chats"
          />
          {facets.length > 0 && (
            <GroupChips
              facets={facets}
              selected={platform ?? null}
              onSelect={(next) => setFilter({ platform: next })}
              allLabel="All chats"
            />
          )}
        </div>
      )}

      <p className="sp-live" role="status" aria-live="polite">
        {announcement}
      </p>

      {/* A classic scrollbar sits in the page's right gutter: the scroller
          gives its width back from its end padding, so the grid keeps the
          header's edges wherever scrollbars take space. */}
      <div
        className="sp-chat-history-frame"
        style={{ "--history-scrollbar": `${fades.gutter}px` } as React.CSSProperties}
      >
        <div ref={scrollRef} className="sp-chat-history-scroll">
          {body}
          {/* The foot of the list: the paging sentinel, and the room that
              keeps the last row's shadow clear of the scroller's edge. */}
          <div ref={sentinelRef} className="sp-chat-history-end" aria-hidden />
        </div>
        <ScrollFade position="top" visible={fades.top} gutter={fades.gutter} />
        <ScrollFade position="bottom" visible={fades.bottom} gutter={fades.gutter} />
      </div>

      <footer className="sp-chat-footer">
        <LegalLinks />
      </footer>
    </Page>
  );
}
