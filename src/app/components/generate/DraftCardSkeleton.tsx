import React from "react";
import { Bone } from "../Skeleton";
import { type DraftCardSize, draftGeometry, draftPreviewSize } from "./DraftCard";

/** One placeholder shape inside the well, in percent of the well so it
 * scales with any ratio: x/y are the top-left corner, w/h the size. */
interface Shape {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** The image block takes the 9px corner; every bar is a pill. */
  block?: boolean;
}

/** The two layouts drawn in sp-result-card-skeleton 284:118, measured off
 * its 211 × 264 (Instagram Portrait) and 505 × 264 (LinkedIn Landscape)
 * wells. Portrait stacks the image over the headlines; landscape sets the
 * headlines left and the image right. `metaBar` is the second meta bar's
 * width, which the frame draws longer on the wide card. */
const LAYOUTS: Record<"portrait" | "landscape", { shapes: Shape[]; metaBar: number }> = {
  portrait: {
    metaBar: 130,
    shapes: [
      { name: "logo", x: 7.806, y: 6.25, w: 25.366, h: 3.03 },
      { name: "image", x: 7.806, y: 14.064, w: 84.39, h: 42.424, block: true },
      { name: "headline-1", x: 7.806, y: 64.064, w: 73.171, h: 5.303 },
      { name: "headline-2", x: 7.806, y: 71.875, w: 58.537, h: 5.303 },
      { name: "button", x: 7.806, y: 88.28, w: 21.464, h: 5.303 },
      { name: "url", x: 33.171, y: 89.455, w: 29.268, h: 3.03 },
    ],
  },
  landscape: {
    metaBar: 150,
    shapes: [
      { name: "logo", x: 4.897, y: 7.814, w: 12.653, h: 3.788 },
      { name: "headline-1", x: 4.897, y: 20.314, w: 36.735, h: 7.576 },
      { name: "headline-2", x: 4.897, y: 31.25, w: 42.857, h: 7.576 },
      { name: "image", x: 58.368, y: 23.439, w: 36.735, h: 46.97, block: true },
      { name: "button", x: 4.897, y: 82.814, w: 12.245, h: 8.333 },
      { name: "url", x: 19.592, y: 85.545, w: 18.367, h: 3.03 },
    ],
  },
};

const SUNKEN = "var(--gen-sunken)";
const PILL = "var(--radius-pill)";

/** The download circle each size stands in for (34 regular, 28 compact). */
const CIRCLE: Record<DraftCardSize, number> = { regular: 34, compact: 28 };

/**
 * A draft that has not landed yet (Figma "Generate · Chat",
 * sp-result-card-skeleton 284:118): a DraftCard's exact geometry for a
 * draft `aspect` (width ÷ height) wide, so the card that replaces it swaps
 * in place without a jump. The well is the deep stage; inside it a sketch
 * of a post (logo, image, two headlines, a button and its link) in the
 * sunken tone, laid out as drawn: stacked for a portrait or square well,
 * side by side for a landscape one. Below, the title row's bars and the
 * download circle. Decoration only: the turn announces its own progress,
 * so the whole card is aria-hidden.
 *
 * The Figma draws Regular only. `size` "compact" is for a follow-up sent
 * while the editor is open (PROMPT §8.5, the cards are Compact there): the
 * same sketch on the compact well, row and circle, so its swap is as
 * still as a regular one.
 */
export function DraftCardSkeleton({
  aspect,
  size = "regular",
  maxWidth,
}: {
  aspect: number;
  /** Match the size the finished card will take. */
  size?: DraftCardSize;
  /** The column the card must fit, as on DraftCard. */
  maxWidth?: number;
}) {
  const well = draftPreviewSize(aspect, size, maxWidth);
  const layout = LAYOUTS[aspect > 1 ? "landscape" : "portrait"];
  const circle = CIRCLE[size];
  return (
    <div
      className="sp-card sp-chat-draft sp-chat-draft--skeleton"
      data-size={size}
      style={draftGeometry(well)}
      aria-hidden
    >
      <div className="sp-chat-draft__preview">
        {layout.shapes.map((s) => (
          <Bone
            key={s.name}
            tone={SUNKEN}
            w={`${s.w}%`}
            h={`${s.h}%`}
            r={s.block ? "var(--radius-control-md)" : PILL}
            style={{ position: "absolute", left: `${s.x}%`, top: `${s.y}%` }}
          />
        ))}
      </div>
      <div className="sp-chat-draft__meta">
        <div className="sp-chat-draft__text">
          <Bone tone={SUNKEN} w={90} h={10} r={PILL} />
          <Bone tone={SUNKEN} w={layout.metaBar} h={8} r={PILL} style={{ maxWidth: "100%" }} />
        </div>
        <Bone tone={SUNKEN} w={circle} h={circle} r={PILL} style={{ flexShrink: 0 }} />
      </div>
    </div>
  );
}
