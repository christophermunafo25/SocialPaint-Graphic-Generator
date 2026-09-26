import React, { useRef } from "react";

/** One segment. `title`, when given, is the segment's tooltip: the whole
 * label, for a switch whose segments can be too narrow to show it. */
export type SegmentOption = { id: string; label: string; title?: string };

/** The two looks the switch comes in, as class names. Only the classes
 * change between them: the markup, the roles and the keyboard are one. */
const CLASSES = {
  /** The caption card's platform switch (Figma sp-caption-card 309:437):
   * 28 tall segments hugging their 10px labels on a 9 radius track. Its
   * rules sit with the caption card's in socialpaint.css. */
  caption: {
    track: "sp-chat-caption__switch",
    segment: "sp-chat-caption__seg",
    label: "sp-chat-caption__seg-label",
  },
  /** The editor's size switch (frame 06, "Size switch"): a 40 tall track at
   * the 12 radius whose 32 tall segments share its width equally. */
  editor: {
    track: "sp-chat-editor__switch",
    segment: "sp-chat-editor__seg",
    label: "sp-chat-editor__seg-label",
  },
} as const;

/**
 * A one-of-N switch on a sunken track (Figma "Generate · Chat": the caption
 * card's platform switch and the editor's size switch). Picking a segment
 * swaps one thing in place (the caption shown, the draft previewed), so it
 * is a radio group rather than a tablist, like GroupChips.
 *
 * Roving tabindex: the group is one stop in the tab order, on the selected
 * segment (or the first, when nothing matches, so the group always keeps
 * its stop). The arrows move and select as they go, wrapping at the ends
 * (Right and Down forward, Left and Up back), Home and End jump to the
 * first and last, and focus follows the selection. A click selects.
 *
 * `variant` picks the look and nothing else: "caption" is the caption
 * card's switch, "editor" the editor panel's. Both draw every colour from
 * tokens, so light and dark live in CSS. The group needs a name: the
 * caption card points `aria-labelledby` at its "Caption" title; the editor
 * has no visible label and passes `aria-label`.
 */
export function SegmentSwitch({
  variant,
  options,
  selectedId,
  onSelect,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: {
  variant: "caption" | "editor";
  options: SegmentOption[];
  selectedId: string | null;
  onSelect(id: string): void;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}) {
  const classes = CLASSES[variant];
  const segRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeIndex = Math.max(
    0,
    options.findIndex((o) => o.id === selectedId),
  );

  const focusAndSelect = (i: number) => {
    onSelect(options[i].id);
    segRefs.current[i]?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      focusAndSelect((activeIndex + 1) % options.length);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      focusAndSelect((activeIndex - 1 + options.length) % options.length);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusAndSelect(0);
    } else if (e.key === "End") {
      e.preventDefault();
      focusAndSelect(options.length - 1);
    }
  };

  return (
    <div
      className={classes.track}
      role="radiogroup"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
    >
      {options.map((option, i) => {
        const isSelected = option.id === selectedId;
        return (
          <button
            key={option.id}
            ref={(el) => {
              segRefs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={isSelected}
            tabIndex={i === activeIndex ? 0 : -1}
            className={classes.segment}
            data-selected={isSelected || undefined}
            title={option.title}
            onClick={() => onSelect(option.id)}
            onKeyDown={onKeyDown}
          >
            <span className={classes.label}>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
