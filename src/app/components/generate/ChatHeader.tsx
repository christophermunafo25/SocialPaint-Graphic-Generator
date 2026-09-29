import React, { forwardRef } from "react";
import { routeToUrl, type Route } from "../../router";
import { ChatButton } from "./ChatButton";
import { HistoryIcon, NewChatIcon } from "./icons";

/** A plain primary click, which the app handles itself; a modified or
 * middle click is the browser's (a new tab or window), as useLinkClick
 * treats a real anchor. */
const isPlainClick = (e: React.MouseEvent) =>
  !e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

const GENERATE_ROOT = { label: "Generate", route: { name: "generate" } } as const;

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
 * carries its own. With no `current` (a saved chat still loading, or one
 * that could not be opened) the trail is "Generate" alone. */
export function ChatBreadcrumb({
  current,
  currentId,
  heading = false,
  onRoot,
  root = GENERATE_ROOT,
}: {
  current?: string;
  /** Lets the thread name itself by the chat's title. */
  currentId?: string;
  heading?: boolean;
  onRoot(): void;
  /** The first crumb: "Generate" by default; "Brand Templates" in a
   * template chat (template-chat PROMPT §12.2). */
  root?: { label: string; route: Route };
}) {
  const Current = heading ? "h1" : "span";
  return (
    <nav aria-label="Breadcrumb" className="sp-chat-crumbs">
      <a
        className="sp-chat-crumbs__root"
        href={routeToUrl(root.route)}
        onClick={(e) => {
          if (!isPlainClick(e)) return;
          e.preventDefault();
          onRoot();
        }}
      >
        {root.label}
      </a>
      {current !== undefined && (
        <>
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
        </>
      )}
    </nav>
  );
}

/** The thread states' page header (Figma "Generate · Chat", frames 04 to
 * 06, "PageHeader"; PROMPT §8.4): the breadcrumb with the chat's title on
 * the left, and on the right History (tertiary) then New chat (secondary),
 * both small, 8 apart. One line, 36 tall. The ref is the page's, which
 * makes the header inert while the editor's sheet is up. `title` null is a
 * saved chat that is still loading or could not be opened: the breadcrumb
 * is "Generate" alone, and the actions work as ever. */
export const ChatHeader = forwardRef<
  HTMLElement,
  {
    title: string | null;
    titleId?: string;
    onNewChat(): void;
    onHistory(): void;
    /** A template chat's first crumb and where it goes (Brand Templates). */
    root?: { label: string; route: Route; onClick(): void };
    /** Replaces History and New chat (a template chat's Start state, which
     * has only the admin's Bulk fill). */
    actions?: React.ReactNode;
  }
>(function ChatHeader({ title, titleId, onNewChat, onHistory, root, actions }, ref) {
  return (
    <header ref={ref} className="sp-chat-header">
      <ChatBreadcrumb
        current={title ?? undefined}
        currentId={titleId}
        heading
        onRoot={root ? root.onClick : onNewChat}
        root={root}
      />
      <div className="sp-chat-header__actions">
        {actions ?? (
          <>
            <ChatButton kind="tertiary" size="small" icon={<HistoryIcon />} onClick={onHistory}>
              History
            </ChatButton>
            <ChatButton kind="secondary" size="small" icon={<NewChatIcon />} onClick={onNewChat}>
              New chat
            </ChatButton>
          </>
        )}
      </div>
    </header>
  );
});
