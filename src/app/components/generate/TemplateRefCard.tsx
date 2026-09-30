import React from "react";
import type { TemplateSchema } from "@/lib/types";
import { aspectRatioOf } from "@/lib/templates/platforms";
import { TemplateThumbnail } from "../TemplateThumbnail";
import { ChatButton } from "./ChatButton";

/** "1080 × 1350 · 4:5 · 3 looks", the looks part only with more than one
 * (template-chat PROMPT §11.9, §15 proposed copy). */
export function templateMeta(t: Pick<TemplateSchema, "canvasWidth" | "canvasHeight" | "variants">) {
  const looks = t.variants?.length ?? 0;
  const size = `${t.canvasWidth} × ${t.canvasHeight} · ${aspectRatioOf(t.canvasWidth, t.canvasHeight)}`;
  return looks > 1 ? `${size} · ${looks} looks` : size;
}

/** The template a template chat is scoped to, at the top of its thread
 * (Figma sp-template-ref 376:71): a 56 × 70 thumbnail in the sunken well at
 * the default look, the name over the size meta, and "Change template",
 * which leaves the chat for Brand Templates (the chat stays in History). */
export function TemplateRefCard({
  template,
  onChange,
}: {
  template: TemplateSchema;
  onChange(): void;
}) {
  return (
    <div className="sp-card sp-chat-tref">
      <span
        className="sp-chat-tref__thumb"
        style={{ aspectRatio: `${template.canvasWidth} / ${template.canvasHeight}` }}
        aria-hidden
      >
        <TemplateThumbnail template={template} />
      </span>
      <span className="sp-chat-tref__text">
        <span className="sp-chat-tref__name">{template.name}</span>
        <span className="sp-chat-tref__meta">{templateMeta(template)}</span>
      </span>
      <ChatButton kind="tertiary" size="small" onClick={onChange}>
        Change template
      </ChatButton>
    </div>
  );
}
