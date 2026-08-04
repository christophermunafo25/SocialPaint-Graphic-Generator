// Canva CDF parser. `design_content` from the MCP `read-design` call (with a
// transaction open) is line-oriented markdown with `[locator_id]` annotations.
// This module parses it into the extractor's common ExtractedElement shape.
//
// Pure functions — no I/O, no Deno globals — so it runs under vitest and in
// the Edge Function alike.
//
// Grammar notes (all observed in real exports):
//  - `size` uses the `×` character, not `x`; `pos` is `x,y` top-left;
//    rotation is degrees.
//  - Coordinates can be negative or exceed the page box (bleed). They are
//    recorded as-is; the validator clamps.
//  - `locked: true` on the pos line → sourceLocked. Its absence means
//    unlocked, which is the signal that matters most.
//  - `fontRef` values are opaque Canva font ids, not family names. They are
//    NEVER mapped to fontFamily — the type-style binding or the brand kit's
//    body font decides instead.
//  - Elements repeating the same mediaId at different positions are distinct
//    elements.

import type { ExtractedElement } from "./extract.ts";

export interface CdfParseResult {
  canvasWidth: number;
  canvasHeight: number;
  elements: ExtractedElement[];
  warnings: string[];
}

const KNOWN_KINDS: Record<string, ExtractedElement["kind"]> = {
  TEXT: "text",
  RECT: "image", // only when fill: IMAGE — see below; plain rects are shapes
  SHAPE: "shape",
};

const num = (s: string | undefined): number | undefined => {
  if (s === undefined) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
};

/** `pos: x,y size: W×H rotation: R opacity: O [locked: true]` */
function parsePosLine(line: string): {
  x: number; y: number; width: number; height: number;
  rotation?: number; opacity?: number; locked: boolean;
} | null {
  const pos = line.match(/pos:\s*(-?[\d.]+),(-?[\d.]+)/);
  const size = line.match(/size:\s*(-?[\d.]+)×(-?[\d.]+)/);
  if (!pos || !size) return null;
  const rotation = num(line.match(/rotation:\s*(-?[\d.]+)/)?.[1]);
  const opacity = num(line.match(/opacity:\s*(-?[\d.]+)/)?.[1]);
  return {
    x: Number(pos[1]),
    y: Number(pos[2]),
    width: Number(size[1]),
    height: Number(size[2]),
    rotation: rotation === 0 ? undefined : rotation,
    opacity: opacity === 1 ? undefined : opacity,
    locked: /\blocked:\s*true\b/.test(line),
  };
}

const ALIGN_MAP: Record<string, "left" | "center" | "right"> = {
  left: "left",
  center: "center",
  right: "right",
  justify: "left",
};

export function parseCanvaCdf(designContent: string): CdfParseResult {
  const lines = designContent.split("\n");
  const warnings: string[] = [];
  const elements: ExtractedElement[] = [];
  let canvasWidth = 0;
  let canvasHeight = 0;
  let pageCount = 0;
  let unresolvedFonts = 0;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Page header — the template canvas is page 1; later pages are skipped.
    if (/^#\s+Page\b/.test(line)) {
      pageCount += 1;
      if (pageCount > 1) {
        warnings.push("This design has multiple pages — only page 1 imported.");
        break;
      }
      i += 1;
      continue;
    }

    const dims = line.match(/^Dimensions:\s*([\d.]+)×([\d.]+)/);
    if (dims && pageCount === 1 && canvasWidth === 0) {
      canvasWidth = Math.round(Number(dims[1]));
      canvasHeight = Math.round(Number(dims[2]));
      i += 1;
      continue;
    }

    const el = line.match(/^##\s+([A-Z_]+)\s+\[([^\]]+)\]/);
    if (!el) {
      i += 1;
      continue;
    }
    const [, rawKind, sourceId] = el;

    // Gather this element's block (until the next ## or #).
    const block: string[] = [];
    i += 1;
    while (i < lines.length && !/^##?\s/.test(lines[i])) {
      block.push(lines[i]);
      i += 1;
    }

    if (!(rawKind in KNOWN_KINDS)) {
      warnings.push(`Skipped an unknown element type "${rawKind}" (${sourceId}).`);
      continue;
    }

    const posLine = block.find((l) => /\bpos:/.test(l));
    const pos = posLine ? parsePosLine(posLine) : null;
    if (!pos) {
      warnings.push(`Skipped ${rawKind} ${sourceId}: no readable position.`);
      continue;
    }

    const base: ExtractedElement = {
      sourceId,
      kind: "shape",
      x: pos.x,
      y: pos.y,
      width: pos.width,
      height: pos.height,
      rotation: pos.rotation,
      opacity: pos.opacity,
      sourceLocked: pos.locked || undefined,
    };

    if (rawKind === "TEXT") {
      base.kind = "text";
      // regions: one or more `  [n] "text" key=value…` lines; concatenate.
      const regionLines = block.filter((l) => /^\s+\[\d+\]\s+"/.test(l));
      const texts: string[] = [];
      let firstStyled: string | undefined;
      for (const rl of regionLines) {
        const text = rl.match(/"((?:[^"\\]|\\.)*)"/)?.[1];
        if (text !== undefined) texts.push(text);
        firstStyled ??= rl;
      }
      base.text = texts.join(" ") || undefined;
      if (firstStyled) {
        base.fontSizePx = num(firstStyled.match(/fontSize=([\d.]+)/)?.[1]);
        const weight = firstStyled.match(/fontWeight=(\w+)/)?.[1];
        base.fontWeight = weight === "bold" ? 700 : weight === "normal" ? 400 : num(weight);
        base.colorHex = firstStyled.match(/color=(#[0-9a-fA-F]{6})/)?.[1]?.toUpperCase();
        const align = firstStyled.match(/textAlign=(\w+)/)?.[1];
        base.align = align ? ALIGN_MAP[align] : undefined;
        base.lineHeight = num(firstStyled.match(/lineHeight=([\d.]+)/)?.[1]);
        const spacing = num(firstStyled.match(/letterSpacing=(-?[\d.]+)/)?.[1]);
        base.letterSpacingPx = spacing || undefined;
      }
      // fontRef is an opaque id — fontFamily stays undefined, counted so the
      // caller can warn once rather than once per element.
      unresolvedFonts += 1;
      elements.push(base);
      continue;
    }

    if (rawKind === "RECT") {
      const fillLine = block.find((l) => /^\s*fill:/.test(l));
      if (fillLine && /\bIMAGE\b/.test(fillLine)) {
        base.kind = "image";
        base.sourceReplaceable = /\breplaceable=true\b/.test(fillLine) || undefined;
        elements.push(base);
      } else {
        // A rect with a solid/other fill is decorative — a shape.
        base.kind = "shape";
        const hex = fillLine?.match(/#[0-9a-fA-F]{6}/)?.[0];
        base.colorHex = hex?.toUpperCase();
        elements.push(base);
      }
      continue;
    }

    // SHAPE
    base.kind = "shape";
    const pathLine = block.find((l) => /^\s*path\[\d+\]:/.test(l));
    base.colorHex = pathLine?.match(/fill=(#[0-9a-fA-F]{6})/)?.[1]?.toUpperCase();
    elements.push(base);
  }

  if (canvasWidth === 0 || canvasHeight === 0) {
    warnings.push("Couldn't read the page dimensions from the design.");
  }
  if (unresolvedFonts > 0) {
    warnings.push(
      `${unresolvedFonts} text element${unresolvedFonts === 1 ? "" : "s"} carry Canva font ids with no family name — bind brand type styles, or they render in the brand's body font.`,
    );
  }

  return { canvasWidth, canvasHeight, elements, warnings };
}
