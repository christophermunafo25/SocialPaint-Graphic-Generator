import React from "react";
import { ArrowDownToLine, Check, Copy, Pencil } from "lucide-react";

/** The Generate chat glyphs lucide doesn't draw the way the Figma does
 * ("Generate · Chat"). Same drawing contract as a lucide icon: a 16-unit
 * box, no fill, a round stroke in currentColor, and the same props shape,
 * so either can sit wherever a lucide icon does. `size` scales the box and
 * keeps the stroke at 1.5 screen pixels (lucide's absoluteStrokeWidth), the
 * way the Figma's 14px compact instances keep their 1.5 stroke. */
interface ChatIconProps {
  className?: string;
  style?: React.CSSProperties;
  "aria-hidden"?: boolean | "true" | "false";
  /** Rendered width and height in px. Defaults to 16. */
  size?: number;
}

const STROKE = 1.5;

function ChatIcon({
  children,
  size = 16,
  ...props
}: ChatIconProps & { children: React.ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={(STROKE * 16) / size}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
}

/** A clock whose ring rewinds counter-clockwise (sp-icon / History 354:879). */
export function HistoryIcon(props: ChatIconProps) {
  return (
    <ChatIcon {...props}>
      <path d="M2.36 10.05A6 6 0 1 0 2.36 5.95" />
      <path d="M4.41 4.51L2.36 5.95L1.71 3.53" />
      <path d="M8 5.25V8L10 9.25" />
    </ChatIcon>
  );
}

/** A speech bubble with a plus (sp-icon / New chat 354:885). */
export function NewChatIcon(props: ChatIconProps) {
  return (
    <ChatIcon {...props}>
      <path d="M4.5 2.5H11.5A2.5 2.5 0 0 1 14 5V9A2.5 2.5 0 0 1 11.5 11.5H7.5L4.75 13.75V11.5H4.5A2.5 2.5 0 0 1 2 9V5A2.5 2.5 0 0 1 4.5 2.5Z" />
      <path d="M8 5V9M6 7H10" />
    </ChatIcon>
  );
}

/** The card glyphs (sp-card-action 308:366 and sp-icon-btn / Download
 * 328:827): lucide's pencil, copy and arrow-down-to-line, as PROMPT §6
 * names them, plus a check for the moment after a copy lands. The Figma
 * draws these at about 0.55 of their 16px box where a lucide glyph at 16
 * fills most of it, so each renders at the size that puts its ink on the
 * Figma's (edit and copy span about 9px, the arrow about 10 tall) and the
 * stroke stays at 1.5 screen px. `compact` is the 14px box of compact
 * cards, scaled alike. */
const CARD_GLYPHS = {
  edit: { Icon: Pencil, size: 10.5 },
  copy: { Icon: Copy, size: 11 },
  download: { Icon: ArrowDownToLine, size: 13.25 },
  check: { Icon: Check, size: 13 },
} as const;

export function CardGlyph({
  glyph,
  compact = false,
  className,
}: {
  glyph: keyof typeof CARD_GLYPHS;
  compact?: boolean;
  className?: string;
}) {
  const { Icon, size } = CARD_GLYPHS[glyph];
  return (
    <Icon
      className={className}
      size={compact ? (size * 14) / 16 : size}
      strokeWidth={STROKE}
      absoluteStrokeWidth
      aria-hidden
    />
  );
}

// ── Template chat and Option D chat box glyphs (Template chat PROMPT §7) ──
// The exact paths of the Figma sp-icon set, each in its own box with its
// own stroke, never a lucide substitute. Same props shape as HistoryIcon;
// `size` defaults to the glyph's designed box and scales the stroke with it,
// the way a Figma instance does.

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

/** The chat box's plus (sp-plus 431:30). */
export function PlusGlyph(props: ChatIconProps) {
  return (
    <Glyph box={14} stroke={1.6} {...props}>
      <path d="M7 2.5V11.5M2.5 7H11.5" />
    </Glyph>
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

/** A tag's remove x. */
export function TagRemoveGlyph(props: ChatIconProps) {
  return (
    <Glyph box={14} stroke={1.17} {...props}>
      <path d="M4.667 4.667L9.333 9.333M9.333 4.667L4.667 9.333" />
    </Glyph>
  );
}

/** Send's arrow (sp-send 431:23). */
export function SendArrowGlyph(props: ChatIconProps) {
  return (
    <Glyph box={16} stroke={1.8} {...props}>
      <path d="M8 12.5V3.5M12 7.5L8 3.5L4 7.5" />
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

/** The file attachment's tile (sp-attachment · D, File). */
export function DocGlyph(props: ChatIconProps) {
  return (
    <Glyph box={20} stroke={1.67} {...props}>
      <path d="M5 2.778H11.111L15 6.667V17.222H5V2.778Z" />
      <path d="M11.111 2.778V6.667H15M7.556 10.556H12.444M7.556 13.333H12.444" />
    </Glyph>
  );
}

/** A link tag's lead glyph (sp-tag / Link 432:40), drawn at 15px. */
export function GlobeGlyph(props: ChatIconProps) {
  return (
    <Glyph box={18} stroke={1.5} {...props}>
      <path d="M15.5 9C15.5 12.59 12.59 15.5 9 15.5C5.41 15.5 2.5 12.59 2.5 9C2.5 5.41 5.41 2.5 9 2.5C12.59 2.5 15.5 5.41 15.5 9Z" />
      <path d="M2.5 9H15.5M9 2.5C10.9 4.5 11.8 6.6 11.8 9C11.8 11.4 10.9 13.5 9 15.5C7.1 13.5 6.2 11.4 6.2 9C6.2 6.6 7.1 4.5 9 2.5Z" />
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
