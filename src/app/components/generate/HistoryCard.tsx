import React, { useId } from "react";
import type { FieldValues, TemplateSchema } from "@/lib/types";
import type { ChatMeta } from "@/lib/generate/relativeDate";
import { TemplateThumbnail } from "../TemplateThumbnail";
import { ChatCardMeta } from "./RecentCard";

/** Loading takes nothing; Default is a real chat and must open. */
type HistoryCardProps =
  | { state: "loading" }
  | {
      state?: "default";
      title: string;
      meta: ChatMeta;
      preview: { schema: TemplateSchema; values: FieldValues; variantId?: string } | null;
      /** Width over height of the draft, for the graphic's box while
       * `preview` is null. Ignored once `preview` is set. */
      aspect?: number;
      onOpen(): void;
    };

/** A chat in the History grid (13:3359, sp-history-card). A square card
 * with an 8 frame: a sunken stage padded 16 that centres the chat's first
 * draft at its own ratio, as large as fits, then the title and meta. The
 * fit is CSS (the stage is a size container), so nothing measures in JS.
 *
 * Default is one button named "Open <title>", the meta its description,
 * with the library card's hover: the shadow deepens, no dim (PHASE-5 §9
 * D11). Its graphic's box takes its shape from `preview`, or from `aspect`
 * while the template loads or once it is gone; with neither (a chat that
 * made no drafts) the stage stays bare.
 *
 * Loading is decoration (aria-hidden; the page announces the load): the
 * bare stage and two bars in the meta's own line boxes, as plain sunken
 * wells (§9 D12), so the card does not move when the chat lands. */
export function HistoryCard(props: HistoryCardProps) {
  const metaId = useId();

  if (props.state === "loading") {
    return (
      <div className="sp-gen-card sp-gen-card--history" data-state="loading" aria-hidden>
        <span className="sp-gen-card__stage" />
        <ChatCardMeta bones />
      </div>
    );
  }

  const { title, meta, preview, aspect, onOpen } = props;
  const ratio = preview ? preview.schema.canvasWidth / preview.schema.canvasHeight : aspect;
  return (
    <button
      type="button"
      className="ui-reset ui-ring sp-gen-card sp-gen-card--history"
      onClick={() => onOpen()}
      aria-label={`Open ${title}`}
      aria-describedby={metaId}
    >
      <span className="sp-gen-card__stage" aria-hidden>
        {ratio !== undefined && (
          <span
            className="sp-gen-card__graphic"
            style={{ "--fit-ratio": ratio } as React.CSSProperties}
          >
            {/* 1px of overscan, clipped by the graphic's radius: the
                renderer's contain rounds a hair short of the box. */}
            {preview && (
              <span className="sp-gen-card__overscan">
                <TemplateThumbnail
                  template={preview.schema}
                  values={preview.values}
                  variantId={preview.variantId}
                  emptyFields="chat"
                />
              </span>
            )}
          </span>
        )}
      </span>
      <ChatCardMeta title={title} meta={meta} metaId={metaId} />
    </button>
  );
}
