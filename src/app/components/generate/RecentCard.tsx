import React, { useId } from "react";
import type { FieldValues, TemplateSchema } from "@/lib/types";
import type { ChatMeta } from "@/lib/generate/relativeDate";
import { Bone } from "../Skeleton";
import { TemplateThumbnail } from "../TemplateThumbnail";

const SUNKEN = "var(--surface-sunken)";
const RADIUS = "var(--radius-control)";

/** The title and meta lines under a chat's preview, shared by the Recent and
 * History cards (Figma sp-recent-card / sp-history-card, "meta"): 14 Medium
 * over 12 Regular in the secondary ink, both truncating (each card sets its
 * own leading and tracking in CSS). The meta line is "<platforms> · <date>"
 * and only the platforms truncate, so the date always shows. `bones` swaps
 * each line for a pulsing sunken Bone inside the same line box, so a
 * loading card keeps the loaded card's height to the pixel. */
export function ChatCardMeta({
  title,
  meta,
  metaId,
  bones = false,
}: {
  title?: string;
  meta?: ChatMeta;
  /** Lets the card point aria-describedby at the meta line, which reads as
   * the whole "<platforms> · <date>". */
  metaId?: string;
  bones?: boolean;
}) {
  if (bones) {
    return (
      <span className="sp-gen-card__meta" data-bones aria-hidden>
        <span className="t-label-m sp-gen-card__title">
          <Bone tone={SUNKEN} w={128} h={10} r={RADIUS} />
        </span>
        <span className="t-caption-s sp-gen-card__line">
          <Bone tone={SUNKEN} w={84} h={8} r={RADIUS} />
        </span>
      </span>
    );
  }
  return (
    <span className="sp-gen-card__meta">
      <span className="t-label-m sp-gen-card__title">{title}</span>
      <span className="t-caption-s sp-gen-card__line" id={metaId}>
        {meta?.platforms && <span className="sp-gen-card__platforms">{meta.platforms}</span>}
        {meta?.date && (
          <span className="sp-gen-card__date">
            {/* A no-break space: a flex item drops a leading ordinary one. */}
            {meta.platforms ? `\u00a0· ${meta.date}` : meta.date}
          </span>
        )}
      </span>
    </span>
  );
}

/** A chat on the Start state's Recent row (13:1560, sp-recent-card). One
 * button on the card recipe with an 8 frame: a 104 tall well showing the
 * chat's first draft letterboxed with contain, then the title and meta.
 * Hover deepens its shadow, as the library's cards do (no dim; CJ,
 * 2026-10-04). The accessible name is "Open <title>"
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
  meta: ChatMeta;
  preview: { schema: TemplateSchema; values: FieldValues; variantId?: string } | null;
  onOpen(): void;
}) {
  const metaId = useId();
  return (
    <button
      type="button"
      className="ui-reset ui-ring sp-gen-card sp-gen-card--recent"
      onClick={onOpen}
      aria-label={`Open ${title}`}
      aria-describedby={metaId}
    >
      <span className="sp-gen-card__well" aria-hidden>
        {preview && (
          <span
            className="sp-gen-card__art"
            style={
              {
                "--fit-ratio": preview.schema.canvasWidth / preview.schema.canvasHeight,
              } as React.CSSProperties
            }
          >
            <TemplateThumbnail
              template={preview.schema}
              values={preview.values}
              variantId={preview.variantId}
              emptyFields="chat"
            />
          </span>
        )}
      </span>
      <ChatCardMeta title={title} meta={meta} metaId={metaId} />
    </button>
  );
}
