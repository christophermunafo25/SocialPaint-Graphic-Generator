import React from "react";
import type { TemplateSchema } from "@/lib/types";
import { Page } from "../layout/Page";
import { TemplateThumbnail } from "../TemplateThumbnail";
import { ChatButton } from "./ChatButton";
import { ChatHeader } from "./ChatHeader";
import { LegalLinks } from "./LegalLinks";

/** A template chat's Start state (Figma "Brand Templates · Chat", frames 01,
 * 01a, 01b; template-chat PROMPT §12.2).
 *
 *  - The header: "Brand Templates / {name}", the first crumb a link back;
 *    for admins, the fill page's Bulk fill on the right. Nothing else until
 *    the chat has a message.
 *  - A centred 760 column: the template's preview (176 × 220 in the sunken
 *    well at the default look, empty fields as the builder paints them), its
 *    name with "Fill in by hand" (the no-credit manual path, one click away)
 *    and "Change template", the greeting, then the chat box.
 *  - The legal links at the foot, as on every chat page. */
export function TemplateChatStart({
  template,
  isAdmin,
  composer,
  onBrandTemplates,
  onFillByHand,
  onBulkFill,
}: {
  template: TemplateSchema;
  isAdmin: boolean;
  /** The compact chat box, owned by the page. */
  composer: React.ReactNode;
  onBrandTemplates(): void;
  onFillByHand(): void;
  onBulkFill(): void;
}) {
  return (
    <Page layout={{ className: "sp-chat-page", state: "start" }}>
      <ChatHeader
        title={template.name}
        onNewChat={onBrandTemplates}
        onHistory={onBrandTemplates}
        root={{ label: "Brand Templates", route: { name: "portal" }, onClick: onBrandTemplates }}
        actions={
          isAdmin ? (
            <ChatButton kind="tertiary" size="small" onClick={onBulkFill}>
              Bulk fill
            </ChatButton>
          ) : (
            <></>
          )
        }
      />
      <div className="sp-chat-start sp-tchat-start">
        <div className="sp-chat-start__column">
          <div className="sp-tchat-start__preview" aria-hidden>
            <span
              className="sp-tchat-start__art"
              style={{ aspectRatio: `${template.canvasWidth} / ${template.canvasHeight}` }}
            >
              <TemplateThumbnail template={template} />
            </span>
          </div>
          <div className="sp-tchat-start__links">
            <span className="sp-tchat-start__name">{template.name}</span>
            <span className="sp-tchat-start__dot" aria-hidden>
              ·
            </span>
            <button type="button" className="sp-tchat-start__link" onClick={onFillByHand}>
              Fill in by hand
            </button>
            <span className="sp-tchat-start__dot" aria-hidden>
              ·
            </span>
            <button type="button" className="sp-tchat-start__link" onClick={onBrandTemplates}>
              Change template
            </button>
          </div>
          <h2 className="sp-tchat-start__greeting">What are we painting on this canvas?</h2>
          <div className="sp-chat-start__composer">{composer}</div>
        </div>
      </div>
      <footer className="sp-chat-footer">
        <LegalLinks />
      </footer>
    </Page>
  );
}
