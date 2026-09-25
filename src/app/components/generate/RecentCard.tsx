import React, { useId } from "react";
import type { FieldValues, TemplateSchema } from "@/lib/types";
import { Bone } from "../Skeleton";
import { TemplateThumbnail } from "../TemplateThumbnail";

const SUNKEN = "var(--gen-sunken)";
const RADIUS = "var(--radius-control)";

/** The title and meta lines under a chat's preview, shared by the Recent and
 * History cards (Figma sp-recent-card / sp-history-card, "meta"): 14 Medium
 * over 12 Regular in the secondary ink, both truncating (each card sets its
 * own leading and tracking in CSS). `bones` swaps each line for a pulsing
 * sunken Bone inside the same line box, so a loading card keeps the loaded
 * card's height to the pixel. */
export function ChatCardMeta({
  title,
  meta,
  metaId,
  bones = false,
}: {
  title?: string;
  meta?: string;
  /** Lets the card point aria-describedby at the meta line. */
  metaId?: string;
  bones?: boolean;
}) {
  if (bones) {
    return (
      <span className="sp-chat-card-meta" data-bones aria-hidden>
        <span className="sp-chat-card-meta__title">
          <Bone tone={SUNKEN} w={128} h={10} r={RADIUS} />
        </span>
        <span className="sp-chat-card-meta__line">
          <Bone tone={SUNKEN} w={84} h={8} r={RADIUS} />
        </span>
      </span>
    );
  }
  return (
    <span className="sp-chat-card-meta">
      <span className="sp-chat-card-meta__title">{title}</span>
      <span className="sp-chat-card-meta__line" id={metaId}>
        {meta}
      </span>
    </span>
  );
}

/** A chat on the Start state's Recent row (Figma "Generate · Chat",
 * sp-recent-card 329:1044). One button, the surface recipe with an 8px
 * frame: a 104 tall well showing the chat's first draft letterboxed with
 * contain, then the title and meta. The accessible name is "Open <title>"
 * with the meta as its description; the preview is decoration (a rendered
 * template carries its own text, which would otherwise read as the name).
 * `preview` null leaves the bare well, as the frame draws it. */
export function RecentCard({
  title,
  meta,
  preview,
  onOpen,
}: {
  title: string;
  meta: string;
  preview: { schema: TemplateSchema; values: FieldValues } | null;
  onOpen(): void;
}) {
  const metaId = useId();
  return (
    <button
      type="button"
      className="sp-card sp-chat-recent-card"
      onClick={onOpen}
      aria-label={`Open ${title}`}
      aria-describedby={metaId}
    >
      <span className="sp-chat-recent-card__well" aria-hidden>
        {preview && (
          <span
            className="sp-chat-recent-card__art"
            style={
              {
                "--fit-ratio": preview.schema.canvasWidth / preview.schema.canvasHeight,
              } as React.CSSProperties
            }
          >
            <TemplateThumbnail template={preview.schema} values={preview.values} />
          </span>
        )}
      </span>
      <ChatCardMeta title={title} meta={meta} metaId={metaId} />
    </button>
  );
}
