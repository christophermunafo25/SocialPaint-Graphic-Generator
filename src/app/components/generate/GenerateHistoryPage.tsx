import React, { useCallback } from "react";
import { useRouter } from "../../router";
import { useFullViewport } from "../layout/ChromeContext";
import { Page } from "../layout/Page";
import { ChatBreadcrumb } from "./ChatHeader";
import { ChatButton } from "./ChatButton";
import { LegalLinks } from "./LegalLinks";
import { NewChatIcon } from "./icons";
import { requestComposerFocus } from "./composerFocus";

/**
 * Every chat the member has started (Figma "Generate · Chat", frame 07;
 * PROMPT §8.6), at /generate/history. A full-height column like the
 * thread: the header (the breadcrumb, the "History" title with New chat on
 * its row, and the description), the body as the only scrolling region,
 * and the legal links at the foot.
 *
 * Chats are not saved yet (§9.8), so there is nothing to list: the body
 * is the empty state, whose New chat is the way back. The filter bar, the
 * card grid and its paging go in the body once there are chats to show.
 *
 * New chat (here and in the empty state) and the breadcrumb's "Generate"
 * (a link to a new chat, §8.6) open a fresh chat with focus in its
 * composer (§9.10).
 */
export function GenerateHistoryPage() {
  const { navigate } = useRouter();
  useFullViewport(true);

  const newChat = useCallback(() => {
    requestComposerFocus();
    navigate({ name: "generate" });
  }, [navigate]);

  return (
    <Page layout={{ className: "sp-chat-page", state: "history" }}>
      <header className="sp-chat-history-head">
        <ChatBreadcrumb current="History" onRoot={newChat} />
        <div className="sp-chat-history-head__title">
          <h1 className="sp-page-title">History</h1>
          <ChatButton kind="secondary" size="small" icon={<NewChatIcon />} onClick={newChat}>
            New chat
          </ChatButton>
        </div>
        <p className="sp-chat-history-head__desc">
          Every chat and the posts it made, newest first. Open one to pick up where you left off.
        </p>
      </header>
      <div className="sp-chat-history-body">
        <div className="sp-emptystate">
          <p className="sp-emptystate__title">No chats yet</p>
          <p className="sp-emptystate__body">
            Chats you start in Generate show up here, newest first.
          </p>
          <div className="sp-emptystate__actions">
            <ChatButton kind="secondary" size="small" icon={<NewChatIcon />} onClick={newChat}>
              New chat
            </ChatButton>
          </div>
        </div>
      </div>
      <footer className="sp-chat-footer">
        <LegalLinks />
      </footer>
    </Page>
  );
}
