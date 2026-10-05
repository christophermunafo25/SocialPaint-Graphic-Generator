import React, { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { GenerateThreadSummary } from "@/lib/types";
import { useAuth } from "@/lib/auth/AuthContext";
import { chatMeta } from "@/lib/generate/relativeDate";
import { NEW_CHAT_TITLE } from "@/lib/generate/runCopy";
import { threadWritesSettled } from "@/lib/generate/threadSaver";
import { stores } from "@/lib/stores";
import { RecentCard } from "./RecentCard";
import { useThreadPreviews } from "./useThreadPreviews";

/** The Start state shows this many chats (PROMPT §8.2, §9.9). */
const RECENT_COUNT = 3;

/** The last list the Recent row showed, for this page load, per account and
 * workspace. A Start state shown again (New chat, back from a chat) draws
 * it at once while the list refreshes behind it, so the centred column does
 * not jump as the row comes and goes. Keyed by the signed-in account as
 * well as the workspace: signing out does not reload the tab, and chats are
 * private to their author (migration 0038), so a colleague who signs in
 * next on this tab must never see one, not even for a frame. */
const lastShown = new Map<string, GenerateThreadSummary[]>();

const NO_CHATS: readonly GenerateThreadSummary[] = [];

/**
 * Recent on the Start state (13:1560; PHASE-5.md §9 D1): the member's three
 * most recently updated chats, 75 under the composer. A header row
 * ("Recent", and View all, which opens History), 12, then up to three
 * RecentCards in one row of three columns: the
 * chat's first draft letterboxed in the well, its title, and its platforms
 * and date ("Instagram, LinkedIn · Today", §9.9). A card opens its chat.
 *
 * Hidden until the list is known, and for good when the member has no
 * chats or the list cannot be read (a failed read is logged; the Start
 * state has nothing to say about it). `onSettled` says when the row has
 * taken its final height (the list landed or failed, or this account's
 * last list had chats and was drawn at once), so the page can show the
 * Start column in place instead of lifting it under the member's caret as
 * the row lands.
 * Library previews paint once their template arrives (useThreadPreviews);
 * until then, and for a template that has gone, the well stays bare.
 */
export function RecentChats({
  companyId,
  onOpen,
  onViewAll,
  onSettled,
}: {
  companyId: string;
  /** A chat's card: its id, and its template when it is a template chat. */
  onOpen(threadId: string, templateId: string | null): void;
  onViewAll(): void;
  /** Called once the row's height is known, at mount when a cached list
   * has chats. */
  onSettled?(): void;
}) {
  const headingId = useId();
  const { user } = useAuth();
  const cacheKey = `${user?.id ?? "local"}:${companyId}`;
  // The list as fetched for one account and workspace. Another key reads
  // its own cache entry (or nothing) until its own list lands.
  const [fetched, setFetched] = useState<{ key: string; items: GenerateThreadSummary[] } | null>(
    null,
  );
  const chats =
    fetched && fetched.key === cacheKey ? fetched.items : (lastShown.get(cacheKey) ?? null);

  const settledRef = useRef(onSettled);
  settledRef.current = onSettled;
  // A cached list is drawn on the first paint, so the row is settled before
  // it: a layout effect, which the page's reveal follows without a frame.
  // Not an empty one: no chats can only become some (the member's first
  // chat, saved since), and the row would then land under the composer, so
  // the page waits for the refresh as it does on a cold load.
  useLayoutEffect(() => {
    if (lastShown.get(cacheKey)?.length) settledRef.current?.();
  }, [cacheKey]);

  // After the writes of a chat just left (New chat, back from a chat), so
  // the list has it at the front; the cached list stands in meanwhile.
  useEffect(() => {
    let alive = true;
    threadWritesSettled()
      .then(() => stores.generateThreads.list(companyId, { limit: RECENT_COUNT }))
      .then(
        ({ items }) => {
          lastShown.set(cacheKey, items);
          if (!alive) return;
          setFetched({ key: cacheKey, items });
          settledRef.current?.();
        },
        (e: unknown) => {
          // What was shown before stays: those chats are still this member's.
          console.error("Load failed", e);
          if (alive) settledRef.current?.();
        },
      );
    return () => {
      alive = false;
    };
  }, [companyId, cacheKey]);

  const previewOf = useThreadPreviews(companyId, chats ?? NO_CHATS);
  if (!chats || chats.length === 0) return null;

  return (
    <section className="sp-gen-recent" aria-labelledby={headingId}>
      <div className="sp-gen-recent__head">
        <h2 id={headingId} className="t-title-panel">
          Recent
        </h2>
        <button
          type="button"
          className="ui-reset ui-ring t-label-m sp-lib-link"
          onClick={onViewAll}
        >
          View all
        </button>
      </div>
      <div className="sp-gen-recent__grid">
        {chats.map((chat) => (
          <RecentCard
            key={chat.id}
            title={chat.title.trim() || NEW_CHAT_TITLE}
            meta={chatMeta(chat.platforms, chat.updatedAt)}
            preview={previewOf(chat).preview}
            onOpen={() => onOpen(chat.id, chat.templateId)}
          />
        ))}
      </div>
    </section>
  );
}
