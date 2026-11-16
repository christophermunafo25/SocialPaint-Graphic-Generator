import React, { useId } from "react";
import type { FieldValues, TemplateSchema } from "@/lib/types";
import type { ChatMeta } from "@/lib/generate/relativeDate";
import { Skeleton } from "../primitives";
import { TemplateThumbnail } from "../TemplateThumbnail";

/** The title and meta lines under a chat's preview, shared by the Recent and
 * History cards (new brand sp-recent-card / sp-history-card, "meta"):
 * Label/M over Caption/M in the secondary ink, 8 apart, both truncating.
 * The meta line is "<platforms> · <date>" and only the platforms truncate,
 * so the date always shows. `bones` swaps each line for a Skeleton as tall
 * as its trimmed text, so a loading card keeps the loaded card's height. */
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
        <Skeleton width={128} height={10} />
        <Skeleton width={84} height={9} />
      </span>
    );
  }
  return (
    <span className="sp-gen-card__meta">
      <span className="t-label-m sp-gen-card__title">{title}</span>
      {/* The line is a flex row, so each part carries the trimmed style. */}
      <span className="sp-gen-card__line" id={metaId}>
        {meta?.platforms && (
          <span className="t-caption-m sp-gen-card__platforms">{meta.platforms}</span>
        )}
        {meta?.date && (
          <span className="t-caption-m sp-gen-card__date">
            {/* A no-break space: a flex item drops a leading ordinary one. */}
            {meta.platforms ? `\u00a0· ${meta.date}` : meta.date}
          </span>
        )}
      </span>
    </span>
  );
}

/** A chat on the Start state's Recent row (13:1453, sp-recent-card). One
 * button on the card recipe with an 8 frame: a 104 tall well showing the
 * chat's first draft letterboxed with contain, then the title and meta.
 * Its hover changes nothing but the pointer: the card keeps Elevation/1, as
 * the library's cards do (RULES.md section 6). The accessible name is
 * "Open <title>"
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
