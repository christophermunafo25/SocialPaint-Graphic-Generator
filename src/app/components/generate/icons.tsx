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
