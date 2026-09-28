import React, { useId } from "react";
import type { FieldValues, TemplateSchema } from "@/lib/types";
import type { ChatMeta } from "@/lib/generate/relativeDate";
import { Bone } from "../Skeleton";
import { TemplateThumbnail } from "../TemplateThumbnail";
import { ChatCardMeta } from "./RecentCard";

/** Width over height of the loading graphic: the draft skeleton's two
 * shapes, Instagram 4:5 and the 1.91:1 link card. */
const LOADING_RATIO = { portrait: 4 / 5, landscape: 1.91 } as const;

const fit = (ratio: number) => ({ "--fit-ratio": ratio }) as React.CSSProperties;

/** Loading takes only its shape; Default is a real chat and must open. */
type HistoryCardProps =
  | {
      state: "loading";
      loadingShape?: "portrait" | "landscape";
    }
  | {
      state?: "default";
      title: string;
      meta: ChatMeta;
      preview: { schema: TemplateSchema; values: FieldValues } | null;
      /** Width over height of the draft, for the placeholder box while
       * `preview` is null. Ignored once `preview` is set. */
      aspect?: number;
      onOpen(): void;
    };

/** A chat in the History grid (Figma "Generate · Chat", sp-history-card
 * 347:859, Format × State Default / Loading). A square card, the surface
 * recipe with an 8px frame: a stage padded 16 on every side that centres
 * the draft at its own aspect ratio, as large as fits, then the title and
 * meta. The padding is the point: the graphic never runs edge to edge. The
 * fit is pure CSS (the stage is a size container, the graphic is
 * min(width, height × ratio) wide), so nothing measures in JS.
 *
 * Default is one button named "Open <title>", the meta as its description.
 * The graphic box shows --gen-stage-graphic until the thumbnail paints
 * over it. Its shape comes from `preview`, or from `aspect` (width over
 * height, the stored preview's canvas size) while the template is still
 * loading or once it is gone; so the page can draw the box before it has a
 * schema. With neither (a chat that made no drafts) the stage stays bare.
 *
 * Loading is decoration (aria-hidden; the page announces the load): the
 * graphic becomes a pulsing sunken Bone in `loadingShape` and the meta two
 * bars in the text's own line boxes, so the card does not move when the
 * chat lands. */
export function HistoryCard(props: HistoryCardProps) {
  const metaId = useId();

  if (props.state === "loading") {
    const { loadingShape = "portrait" } = props;
    return (
      <div className="sp-card sp-chat-history-card" data-state="loading" aria-hidden>
        <span className="sp-chat-history-card__stage">
          <span className="sp-chat-history-card__graphic" style={fit(LOADING_RATIO[loadingShape])}>
            <Bone
              tone="var(--gen-sunken)"
              w="100%"
              h="100%"
              r="var(--radius-control)"
              style={{ position: "absolute", inset: 0 }}
            />
          </span>
        </span>
        <ChatCardMeta bones />
      </div>
    );
  }

  const { title, meta, preview, aspect, onOpen } = props;
  const ratio = preview ? preview.schema.canvasWidth / preview.schema.canvasHeight : aspect;
  return (
    <button
      type="button"
      className="sp-card sp-chat-history-card"
      data-state="default"
      onClick={() => onOpen()}
      aria-label={`Open ${title}`}
      aria-describedby={metaId}
    >
      <span className="sp-chat-history-card__stage" aria-hidden>
        {ratio !== undefined && (
          <span className="sp-chat-history-card__graphic" style={fit(ratio)}>
            {/* 1px of overscan on every side, clipped by the graphic's own
                radius: the renderer's contain rounds a hair short of the
                box, and the placeholder fill would show through the gap as
                an inner border (the template card's fix, 2026-09-15). */}
            {preview && (
              <span className="sp-chat-history-card__art">
                <TemplateThumbnail template={preview.schema} values={preview.values} />
              </span>
            )}
          </span>
        )}
      </span>
      <ChatCardMeta title={title} meta={meta} metaId={metaId} />
    </button>
  );
}
