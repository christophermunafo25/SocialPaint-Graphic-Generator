import React from "react";
import { routeToUrl } from "../../router";
import { ChatButton } from "./ChatButton";
import { HistoryIcon, NewChatIcon } from "./icons";

/** A plain primary click, which the app handles itself; a modified or
 * middle click is the browser's (a new tab or window), as useLinkClick
 * treats a real anchor. */
const isPlainClick = (e: React.MouseEvent) =>
  !e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

/** The breadcrumb over a chat and over History (Figma "Generate · Chat",
 * frames 04 and 05, "Breadcrumb"; PROMPT §8.4, §8.6): "Generate" in the
 * secondary ink, underlined, as a real link to a new chat, a muted slash,
 * then where the member is, in the primary ink, truncating at 40% of the
 * header's width. All three are 14/125%.
 *
 * `onRoot` runs on a plain click of "Generate" instead of the browser's
 * navigation, so the chat can stop its run and start over in place (a new
 * chat and the current one can share a URL). `heading` makes the current
 * crumb the page's h1: a chat has no other title on screen, while History
 * carries its own. */
export function ChatBreadcrumb({
  current,
  currentId,
  heading = false,
  onRoot,
}: {
  current: string;
  /** Lets the thread name itself by the chat's title. */
  currentId?: string;
  heading?: boolean;
  onRoot(): void;
}) {
  const Current = heading ? "h1" : "span";
  return (
    <nav aria-label="Breadcrumb" className="sp-chat-crumbs">
      <a
        className="sp-chat-crumbs__root"
        href={routeToUrl({ name: "generate" })}
        onClick={(e) => {
          if (!isPlainClick(e)) return;
          e.preventDefault();
          onRoot();
        }}
      >
        Generate
      </a>
      <span className="sp-chat-crumbs__sep" aria-hidden>
        /
      </span>
      {/* The title attribute shows a title the header has cut short. */}
      <Current
        id={currentId}
        className="sp-chat-crumbs__current"
        aria-current="page"
        title={current}
      >
        {current}
      </Current>
    </nav>
  );
}

/** The thread states' page header (Figma "Generate · Chat", frames 04 and
 * 05, "PageHeader"; PROMPT §8.4): the breadcrumb with the chat's title on
 * the left, and on the right History (tertiary) then New chat (secondary),
 * both small, 8 apart. One line, 36 tall. */
export function ChatHeader({
  title,
  titleId,
  onNewChat,
  onHistory,
}: {
  title: string;
  titleId: string;
  onNewChat(): void;
  onHistory(): void;
}) {
  return (
    <header className="sp-chat-header">
      <ChatBreadcrumb current={title} currentId={titleId} heading onRoot={onNewChat} />
      <div className="sp-chat-header__actions">
        <ChatButton kind="tertiary" size="small" icon={<HistoryIcon />} onClick={onHistory}>
          History
        </ChatButton>
        <ChatButton kind="secondary" size="small" icon={<NewChatIcon />} onClick={onNewChat}>
          New chat
        </ChatButton>
      </div>
    </header>
  );
}
