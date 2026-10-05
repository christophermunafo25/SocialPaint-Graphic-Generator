import React from "react";

/** The chat glyphs lucide doesn't draw the way the Figma does: the exact
 * paths of the Figma sp-icon set, each in its own box with its own stroke,
 * never a lucide substitute. Same props shape as a lucide icon; `size`
 * defaults to the glyph's designed box and scales the stroke with it, the
 * way a Figma instance does. */
interface ChatIconProps {
  className?: string;
  style?: React.CSSProperties;
  "aria-hidden"?: boolean | "true" | "false";
  /** Rendered width and height in px. Defaults to the glyph's box. */
  size?: number;
}

function Glyph({
  box,
  stroke,
  size = box,
  children,
  ...props
}: ChatIconProps & { box: number; stroke: number; children: React.ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox={`0 0 ${box} ${box}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
}

/** The Missing tag's plus (sp-tag / Field, State=Missing). */
export function TagPlusGlyph(props: ChatIconProps) {
  return (
    <Glyph box={10} stroke={1.25} {...props}>
      <path d="M5 1.5V8.5M1.5 5H8.5" />
    </Glyph>
  );
}

/** Upload · Photo. */
export function PhotoGlyph(props: ChatIconProps) {
  return (
    <Glyph box={18} stroke={1.5} {...props}>
      <path d="M13 3.5H5C3.619 3.5 2.5 4.619 2.5 6V12C2.5 13.381 3.619 14.5 5 14.5H13C14.381 14.5 15.5 13.381 15.5 12V6C15.5 4.619 14.381 3.5 13 3.5Z" />
      <path d="M7 8.75C7.69 8.75 8.25 8.19 8.25 7.5C8.25 6.81 7.69 6.25 7 6.25C6.31 6.25 5.75 6.81 5.75 7.5C5.75 8.19 6.31 8.75 7 8.75Z" />
      <path d="M3.5 13L7.3 9.6L10 12L12 10.4L14.5 12.5" />
    </Glyph>
  );
}

/** Upload · File. */
export function FileGlyph(props: ChatIconProps) {
  return (
    <Glyph box={18} stroke={1.5} {...props}>
      <path d="M4.5 2.5H10L13.5 6V15.5H4.5V2.5Z" />
      <path d="M10 2.5V6H13.5M6.8 9.5H11.2M6.8 12H11.2" />
    </Glyph>
  );
}

/** Upload · Brand Studio (sp-icon / Brand Studio 468:235), traced from the
 * component sheet: two diamonds (a ruler), their two ticks and a pencil,
 * drawn on a 24 grid and scaled into the 18 box, so the 1.5 grid stroke
 * lands at the Figma's 1.13. It is the same drawing the sidebar's Brand
 * Studio item shows. */
export function BrandStudioGlyph(props: ChatIconProps) {
  return (
    <Glyph box={18} stroke={1.5} {...props}>
      <g transform="scale(0.75)">
        <path d="M13 7L8.7 2.7a2.41 2.41 0 0 0-3.4 0L2.7 5.3a2.41 2.41 0 0 0 0 3.4L7 13" />
        <path d="M8 6L10 4M18 16L20 14" />
        <path d="M17 11L21.3 15.3c.94.94.94 2.46 0 3.4l-2.6 2.6c-.94.94-2.46.94-3.4 0L11 17" />
        <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
        <path d="M15 5L19 9" />
      </g>
    </Glyph>
  );
}
