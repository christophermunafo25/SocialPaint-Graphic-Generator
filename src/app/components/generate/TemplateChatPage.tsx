import React, { useCallback, useEffect, useState } from "react";
import type { TemplateSchema } from "@/lib/types";
import type { ChatThread } from "@/lib/generate/chat";
import { threadWritesSettled } from "@/lib/generate/threadSaver";
import { fromStoredThread } from "@/lib/generate/threadStorage";
import { stores } from "@/lib/stores";
import { useAuth } from "@/lib/auth/AuthContext";
import { useAsync } from "@/lib/useAsync";
import { useRouter } from "../../router";
import { Page } from "../layout/Page";
import { Button } from "../primitives";
import { ChatLoading, ChatUnavailable } from "./ChatLoadStates";
import { requestComposerFocus, requestHistoryFocus } from "./composerFocus";
import { GenerateChat } from "./GeneratePage";

/** What the page resolved: the template (and a saved chat) to show, or
 * where to send the member instead. */
type Resolved =
  | { kind: "ready"; template: TemplateSchema; initial: ChatThread | null }
  | { kind: "unavailable" }
  | { kind: "missingChat" }
  | { kind: "redirect"; to: "generate"; threadId: string }
  | { kind: "redirect"; to: "templateChat"; templateId: string; threadId: string };

/** A template this company's members can chat on: published, and theirs. */
const usable = (t: TemplateSchema | null, companyId: string): t is TemplateSchema =>
  Boolean(t && t.status === "published" && t.companyId === companyId);

/**
 * A template chat, at /templates/<templateId>/chat (a new chat) and
 * /templates/<templateId>/chat/<threadId> (a saved one); template-chat
 * PROMPT §12.1. App keys it per template and per chat (templateChatPageKey),
 * so each is a fresh mount and its data is read once.
 *
 *  - A new chat on a template that is not published, or not this
 *    company's, says "This template isn't available any more." with a way
 *    back to Brand Templates.
 *  - A saved chat whose template was deleted, or is no longer published,
 *    opens at /generate/c/<id> as an ordinary Generate chat. One saved
 *    under another template goes to that template's address.
 *  - Where the chat cannot run (isConfigured() false: a production build
 *    on the local backend), the template opens on its fill page instead,
 *    as the cards do.
 *
 * Once loaded it is the Generate chat in its template mode (GenerateChat),
 * so saving, the editor, downloads and follow-ups are that page's.
 */
export function TemplateChatPage({
  templateId,
  threadId,
}: {
  templateId: string;
  threadId?: string;
}) {
  const { company } = useAuth();
  const { navigate } = useRouter();
  const companyId = company?.id ?? null;
  const configured = stores.generate.isConfigured();
  // Read once: the first save's own address change keeps this page mounted
  // and must not load the chat over itself (templateChatPageKey).
  const [openedId] = useState(threadId ?? null);

  const load = useAsync(async (): Promise<Resolved | null> => {
    if (!companyId || !configured) return null;
    if (!openedId) {
      const template = await stores.templates.get(templateId);
      return usable(template, companyId)
        ? { kind: "ready", template, initial: null }
        : { kind: "unavailable" };
    }
    // A write of this chat may still be in flight: read the row it leaves.
    await threadWritesSettled();
    const record = await stores.generateThreads.get(companyId, openedId);
    if (!record) return { kind: "missingChat" };
    if (record.templateId && record.templateId !== templateId) {
      return {
        kind: "redirect",
        to: "templateChat",
        templateId: record.templateId,
        threadId: openedId,
      };
    }
    const template = record.templateId ? await stores.templates.get(record.templateId) : null;
    if (!usable(template, companyId)) {
      return { kind: "redirect", to: "generate", threadId: openedId };
    }
    const initial = await fromStoredThread(record, {
      companyId,
      getTemplate: (id) => stores.templates.get(id),
    });
    return { kind: "ready", template, initial };
  }, [companyId, configured, openedId, templateId]);

  // Unavailable: the fill page, as the Brand Templates cards fall back.
  useEffect(() => {
    if (!configured) navigate({ name: "template", templateId }, { replace: true });
  }, [configured, navigate, templateId]);

  const resolved = load.status === "ready" ? load.data : null;
  useEffect(() => {
    if (resolved?.kind !== "redirect") return;
    navigate(
      resolved.to === "generate"
        ? { name: "generate", threadId: resolved.threadId }
        : { name: "templateChat", templateId: resolved.templateId, threadId: resolved.threadId },
      { replace: true },
    );
  }, [resolved, navigate]);

  const newChat = useCallback(() => {
    requestComposerFocus();
    navigate({ name: "templateChat", templateId });
  }, [navigate, templateId]);
  const history = useCallback(() => {
    requestHistoryFocus();
    navigate({ name: "generateHistory" });
  }, [navigate]);
  const brandTemplates = useCallback(() => navigate({ name: "portal" }), [navigate]);

  if (!configured) return null;
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
  if (!resolved || resolved.kind === "redirect") {
    return <ChatLoading onNewChat={newChat} onHistory={history} />;
  }
  if (resolved.kind === "missingChat") {
    return <ChatUnavailable reason="missing" onNewChat={newChat} onHistory={history} />;
  }
  if (resolved.kind === "unavailable") {
    return (
      <Page layout={{ className: "sp-chat-page", state: "start" }}>
        <div className="sp-chat-start">
          <div className="sp-emptystate sp-tchat-gone" role="status">
            <p className="sp-emptystate__title">This template isn't available any more.</p>
            <Button kind="neutralOnPage" size="sm" onClick={brandTemplates}>
              Back to Brand Templates
            </Button>
          </div>
        </div>
      </Page>
    );
  }
  return <GenerateChat template={resolved.template} initial={resolved.initial} />;
}
