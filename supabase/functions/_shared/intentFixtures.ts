// Node trees for the import intent tests: the structure of a keyed portrait
// post (a masked photo, a plate holding a headline and a row with a pill and
// a logo), built by hand with neutral content. Layer names, auto layout and
// type metrics are what a designer's file carries; no client asset is here.

import type { FigmaNode } from "./extract.ts";

const FRAME_X = 12000;
const FRAME_Y = 4650;

const box = (x: number, y: number, width: number, height: number) => ({
  x: FRAME_X + x,
  y: FRAME_Y + y,
  width,
  height,
});

const solid = (r: number, g: number, b: number) => ({
  type: "SOLID",
  color: { r, g, b, a: 1 },
});

const IDENTITY = [
  [1, 0, 0],
  [0, 1, 0],
];

export interface PortraitOptions {
  /** Layer names by node, to replay the same frame unkeyed. */
  names?: Partial<Record<"photo" | "plate" | "headline" | "pill" | "pillText" | "logo", string>>;
  /** The row holding the pill and the logo. */
  rowAlign?: "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN";
  /** Put the pill last in its row. */
  pillLast?: boolean;
}

/** A 1080 x 1350 portrait post keyed in the recipe grammar. */
export function portraitWithPlate(opts: PortraitOptions = {}): FigmaNode {
  const names = {
    photo: "photo-fill · image · fit=cover · edit=member",
    plate: "plate · plate · fill=accent · edit=fixed",
    headline: "headline · text · edit=member · max=32 · lines=3 · text=on-accent · align=left",
    pill: "cta · pill · fill=card · edit=fixed",
    pillText: "cta · text · edit=member · max=24 · text=on-card · align=center",
    logo: "logo · logo · variant=primary · surface=light · edit=fixed",
    ...opts.names,
  };

  const pill = {
    id: "40:2",
    name: names.pill,
    type: "FRAME",
    fills: [solid(0.969, 0.749, 0.627)],
    cornerRadius: 999,
    layoutMode: "HORIZONTAL",
    primaryAxisAlignItems: "CENTER",
    counterAxisAlignItems: "CENTER",
    counterAxisSizingMode: "FIXED",
    paddingLeft: 44,
    paddingRight: 44,
    paddingTop: 26,
    paddingBottom: 26,
    layoutSizingHorizontal: "HUG",
    layoutSizingVertical: "FILL",
    absoluteBoundingBox: box(opts.pillLast ? 588 : 133, 1119, 359, 76),
    relativeTransform: IDENTITY,
    size: { x: 359, y: 76 },
    effects: [],
    children: [
      {
        id: "40:3",
        name: names.pillText,
        type: "TEXT",
        characters: "Read the answer",
        fills: [solid(0, 0.212, 0.349)],
        absoluteBoundingBox: box(opts.pillLast ? 632 : 177, 1146, 271, 22),
        relativeTransform: IDENTITY,
        size: { x: 271, y: 22 },
        layoutSizingHorizontal: "HUG",
        layoutSizingVertical: "HUG",
        style: {
          fontFamily: "Inter",
          fontWeight: 500,
          fontSize: 30,
          textAlignHorizontal: "LEFT",
          textAlignVertical: "TOP",
          leadingTrim: "CAP_HEIGHT",
          letterSpacing: 0,
          lineHeightPx: 39,
          lineHeightPercentFontSize: 130,
        },
        effects: [],
      },
    ],
  };

  const logo = {
    id: "33:19",
    name: names.logo,
    type: "RECTANGLE",
    fills: [{ type: "IMAGE", scaleMode: "FILL", imageRef: "logo-ref" }],
    absoluteBoundingBox: box(opts.pillLast ? 133 : 707, 1119, 240, 76),
    relativeTransform: IDENTITY,
    size: { x: 240, y: 76 },
    layoutSizingHorizontal: "FIXED",
    layoutSizingVertical: "FIXED",
    effects: [],
  };

  const row = {
    id: "40:5",
    name: "Frame 8",
    type: "FRAME",
    fills: [],
    layoutMode: "HORIZONTAL",
    primaryAxisSizingMode: "FIXED",
    primaryAxisAlignItems: opts.rowAlign ?? "SPACE_BETWEEN",
    counterAxisAlignItems: "CENTER",
    itemSpacing: 40,
    layoutSizingHorizontal: "FILL",
    layoutSizingVertical: "HUG",
    absoluteBoundingBox: box(133, 1119, 814, 76),
    relativeTransform: IDENTITY,
    size: { x: 814, y: 76 },
    effects: [],
    children: opts.pillLast ? [logo, pill] : [pill, logo],
  };

  const headline = {
    id: "33:18",
    name: names.headline,
    type: "TEXT",
    characters: "Is it time to drop the naps?",
    fills: [solid(0.047, 0.212, 0.329)],
    absoluteBoundingBox: box(133, 872, 709, 151),
    relativeTransform: IDENTITY,
    size: { x: 709, y: 151 },
    style: {
      fontFamily: "Newsreader",
      fontWeight: 500,
      fontSize: 88,
      textAlignHorizontal: "LEFT",
      textAlignVertical: "TOP",
      leadingTrim: "CAP_HEIGHT",
      letterSpacing: -2.2,
      lineHeightPx: 92.4,
      lineHeightPercentFontSize: 105,
    },
    effects: [],
  };

  const root = {
    id: "33:12",
    name: "P15 · Topic · Portrait with plate",
    type: "FRAME",
    clipsContent: true,
    fills: [solid(0.047, 0.212, 0.329)],
    absoluteBoundingBox: box(0, 0, 1080, 1350),
    size: { x: 1080, y: 1350 },
    effects: [],
    children: [
      {
        id: "32:40",
        name: "Mask group",
        type: "GROUP",
        fills: [],
        absoluteBoundingBox: box(0, 0, 1080, 1350),
        relativeTransform: IDENTITY,
        size: { x: 1080, y: 1350 },
        effects: [],
        children: [
          {
            id: "32:41",
            name: "Rectangle 1",
            type: "RECTANGLE",
            isMask: true,
            maskType: "ALPHA",
            fills: [
              {
                type: "GRADIENT_LINEAR",
                gradientHandlePositions: [
                  { x: 0.5, y: 0.69 },
                  { x: 0.5, y: 1 },
                  { x: 0.35, y: 0.69 },
                ],
                gradientStops: [
                  { position: 0, color: { r: 0.85, g: 0.85, b: 0.85, a: 1 } },
                  { position: 1, color: { r: 0.45, g: 0.45, b: 0.45, a: 0 } },
                ],
              },
            ],
            absoluteBoundingBox: box(0, 0, 1080, 1350),
            relativeTransform: IDENTITY,
            size: { x: 1080, y: 1350 },
            effects: [],
          },
          {
            id: "32:42",
            name: names.photo,
            type: "RECTANGLE",
            fills: [
              {
                type: "IMAGE",
                scaleMode: "STRETCH",
                imageRef: "photo-ref",
                imageTransform: [
                  [1, 0, 0],
                  [0, 0.9232, -0.0003],
                ],
              },
            ],
            absoluteBoundingBox: box(0, 0, 1080, 1350),
            relativeTransform: IDENTITY,
            size: { x: 1080, y: 1350 },
            effects: [],
          },
        ],
      },
      {
        id: "33:16",
        name: names.plate,
        type: "FRAME",
        fills: [solid(1, 0.878, 0.812)],
        cornerRadius: 40,
        layoutMode: "VERTICAL",
        primaryAxisSizingMode: "FIXED",
        counterAxisSizingMode: "FIXED",
        primaryAxisAlignItems: "SPACE_BETWEEN",
        paddingLeft: 56,
        paddingRight: 56,
        paddingTop: 70,
        paddingBottom: 45,
        itemSpacing: 40,
        layoutSizingHorizontal: "FIXED",
        layoutSizingVertical: "FIXED",
        absoluteBoundingBox: box(77, 802, 926, 438),
        relativeTransform: IDENTITY,
        size: { x: 926, y: 438 },
        effects: [],
        children: [
          {
            id: "40:6",
            name: "Group 8",
            type: "GROUP",
            fills: [],
            absoluteBoundingBox: box(133, 872, 709, 151),
            relativeTransform: IDENTITY,
            size: { x: 709, y: 151 },
            layoutSizingHorizontal: "FIXED",
            layoutSizingVertical: "FIXED",
            effects: [],
            children: [headline],
          },
          row,
        ],
      },
    ],
  };
  return root as unknown as FigmaNode;
}

/** The same frame with every layer named as Figma names it by default. */
export const UNKEYED_NAMES = {
  photo: "image 1",
  plate: "Frame 7",
  headline: "Is it time to drop the naps?",
  pill: "Frame 6",
  pillText: "Read the answer",
  logo: "image 2",
} as const;
