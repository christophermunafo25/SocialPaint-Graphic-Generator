import React, { useEffect, useRef } from "react";
import { useFullViewport } from "../layout/ChromeContext";
import { Page } from "../layout/Page";
import { ErrorState } from "../ErrorState";
import { Bone } from "../Skeleton";
import { AssistantHeader } from "./AssistantHeader";
import { CaptionCard } from "./CaptionCard";
import { ChatButton } from "./ChatButton";
import { ChatHeader } from "./ChatHeader";
import { Composer } from "./Composer";
import { DraftCardSkeleton } from "./DraftCardSkeleton";
import { ChatFootnote, LegalLinks } from "./LegalLinks";
import { useScrollFades } from "./ScrollFade";
import { NewChatIcon } from "./icons";
import { takeComposerFocus } from "./composerFocus";

/** The thread's composer placeholder (PROMPT §7.9), here and on the page. */
export const THREAD_PLACEHOLDER = "Ask for changes or describe a new post";

const SUNKEN = "var(--gen-sunken)";
const noop = () => {};

/** The actions every state of a saved chat's page keeps in its header. */
interface ChatPageActions {
  onNewChat(): void;
  onHistory(): void;
}

/**
 * A saved chat while it opens (PROMPT §9.8): the record, then the
 * templates its library drafts fill, load before the thread can show. The
 * thread states' own layout stands in, so nothing moves when the chat
 * lands: the header (the breadcrumb is "Generate" until the title is
 * known; History and New chat already work), then a sketch of an exchange
 * in the thread (the member's bubble, the byline, a status line, a draft
 * skeleton and a loading caption card, all in the sunken tone), and the
 * dock with its composer inert. The sketch is decoration; the thread
 * announces itself once as busy.
 */
export function ChatLoading({ onNewChat, onHistory }: ChatPageActions) {
  useFullViewport(true);
  // The thread's scrollbar gutter, handed back as the real thread does, so
  // the sketch's column does not jump sideways when the chat replaces it.
  const threadRef = useRef<HTMLDivElement>(null);
  const { gutter } = useScrollFades(threadRef);
  return (
    <Page layout={{ className: "sp-chat-page", state: "thread" }}>
      <ChatHeader title={null} onNewChat={onNewChat} onHistory={onHistory} />
      <div className="sp-chat-split">
        <div className="sp-chat-split__chat">
          <div className="sp-chat-thread-frame">
            <div
              ref={threadRef}
              className="sp-chat-thread"
              style={{ "--thread-scrollbar": `${gutter}px` } as React.CSSProperties}
              aria-busy="true"
              aria-label="Loading chat"
            >
              <div className="sp-chat-thread__column" aria-hidden>
                <div className="sp-chat-user">
                  <Bone tone={SUNKEN} w="min(320px, 70%)" h={46} r="var(--radius-control-lg)" />
                </div>
                <div className="sp-chat-turn">
                  <AssistantHeader />
                  <div className="sp-chat-loading__status">
                    <Bone tone={SUNKEN} w="min(360px, 80%)" h={12} r="var(--radius-pill)" />
                  </div>
                  <div className="sp-chat-turn__drafts">
                    <DraftCardSkeleton aspect={4 / 5} />
                  </div>
                  <CaptionCard state="loading" />
                </div>
              </div>
            </div>
          </div>
          <div className="sp-chat-dock">
            <div className="sp-chat-dock__composer">
              <Composer
                size="compact"
                value=""
                onChange={noop}
                photo={null}
                onPhotoChange={noop}
                running={false}
                onSubmit={noop}
                onStop={noop}
                placeholder={THREAD_PLACEHOLDER}
                disabled
              />
            </div>
            <ChatFootnote />
          </div>
        </div>
      </div>
    </Page>
  );
}

/**
 * A saved chat that could not be opened (PROMPT §9.8), in History's
 * language for the same failures (§8.6): `error` is a load that failed
 * (the network, or the store), with Try again; `missing` is an address
 * that names no chat of the member's in this workspace (deleted, another
 * member's, another workspace's, or not a chat id at all). The header
 * keeps History and New chat, and a focus request meant for the chat's
 * composer is dropped, so it never lands on a later page instead.
 */
export function ChatUnavailable({
  onNewChat,
  onHistory,
  ...failure
}: ChatPageActions & ({ reason: "error"; onRetry(): void } | { reason: "missing" })) {
  useFullViewport(true);
  useEffect(() => {
    takeComposerFocus();
  }, []);
  return (
    <Page layout={{ className: "sp-chat-page", state: "thread" }}>
      <ChatHeader title={null} onNewChat={onNewChat} onHistory={onHistory} />
      <div className="sp-chat-unavailable">
        {failure.reason === "error" ? (
          <ErrorState
            title="We couldn't load this chat."
            detail="Check your connection and try again."
            onRetry={failure.onRetry}
          />
        ) : (
          <div className="sp-emptystate">
            <p className="sp-emptystate__title">We couldn't find this chat.</p>
            <p className="sp-emptystate__body">
              It may have been deleted, or it was started in another workspace or account.
            </p>
            <div className="sp-emptystate__actions">
              <ChatButton kind="secondary" size="small" icon={<NewChatIcon />} onClick={onNewChat}>
                New chat
              </ChatButton>
            </div>
          </div>
        )}
      </div>
      <footer className="sp-chat-footer">
        <LegalLinks />
      </footer>
    </Page>
  );
}
