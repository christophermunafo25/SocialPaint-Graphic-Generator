import React, { useEffect, useId, useRef, useState } from "react";
import { Bone } from "../Skeleton";
import { CardAction } from "./CardAction";
import { SegmentSwitch, type SegmentOption } from "./SegmentSwitch";

/** How long the Copy action shows its check after a write lands. */
const COPIED_MS = 1500;

const SUNKEN = "var(--gen-sunken)";
const PILL = "var(--radius-pill)";

type CaptionTab = SegmentOption;

/** Ready needs the turn's captions; Loading needs nothing, and ignores the
 * ready props when a caller passes them anyway (one call site can flip
 * `state` without branching). */
type CaptionCardProps =
  | {
      state: "ready";
      /** One per draft in the turn, labelled by platform (or template name). */
      tabs: CaptionTab[];
      selectedId: string | null;
      onSelect(id: string): void;
      /** The selected draft's caption, already merged from current values. */
      caption: string;
    }
  | {
      state: "loading";
      tabs?: CaptionTab[];
      selectedId?: string | null;
      onSelect?(id: string): void;
      caption?: string;
    };

/**
 * The caption under an assistant turn's drafts (Figma "Generate · Chat",
 * sp-caption-card 309:437, State Ready / Loading). A card on the surface
 * recipe that spans the chat column: "Caption", a platform switch when the
 * turn has two or more drafts, a Copy action, and the selected draft's
 * caption as written (line breaks kept).
 *
 * The switch is SegmentSwitch's caption look: a radio group rather than a
 * tablist, like GroupChips, since it swaps the one caption in place instead
 * of showing a panel per tab. Roving tabindex, so it is one stop in the tab
 * order; the arrows move and select as they go. It is labelled by the
 * card's "Caption" title.
 *
 * Copy owns its own feedback: it writes the visible caption, swaps the
 * glyph to a check for 1.5s and says "Caption copied" in a visually hidden
 * status. The feedback follows a copy and nothing else: picking another
 * draft, or any change to the visible caption, drops it for good, so
 * coming back to the copied text within the 1.5s neither shows the check
 * nor announces a copy that did not happen. A denied write (no user
 * activation, a restrictive browser) claims nothing.
 *
 * Loading stands in with the same geometry: a title bar, the switch block
 * and the action circle in a 36px header, then two caption lines, as
 * sunken Bones that pulse like the draft skeletons beside them. It is
 * decoration (aria-hidden); the turn's status sentence carries the
 * progress.
 */
export function CaptionCard(props: CaptionCardProps) {
  // Null while loading, so a check left over from before a regenerate drops.
  const visible = props.state === "ready" ? props.caption : null;
  const titleId = useId();
  // The caption that was last copied, while its check is showing.
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );
  // The check belongs to the text that was copied. Once the visible caption
  // is something else (an edit, a regenerate), drop it during render, before
  // anything commits, so the glyph and the live region never show it against
  // other text and returning to the copied text does not bring it back. (An
  // effect would run after paint: a frame of the stale check, and a second
  // announcement.)
  if (copiedText !== null && copiedText !== visible) setCopiedText(null);

  if (props.state === "loading") {
    const fixed = { flexShrink: 0 };
    return (
      <div className="sp-card sp-chat-caption" data-state="loading" aria-hidden>
        <div className="sp-chat-caption__header">
          <div className="sp-chat-caption__lead">
            <Bone tone={SUNKEN} w={56} h={10} r="var(--radius-control)" style={fixed} />
            <Bone
              tone={SUNKEN}
              w={150}
              h="var(--gen-h-sm)"
              r="var(--radius-control-md)"
              style={fixed}
            />
          </div>
          <Bone tone={SUNKEN} w={32} h={32} r={PILL} style={fixed} />
        </div>
        <div className="sp-chat-caption__lines">
          {/* The frame's 6 radius: half the 12px height. */}
          <Bone tone={SUNKEN} w="100%" h={12} r={PILL} />
          <Bone tone={SUNKEN} w="50%" h={12} r={PILL} />
        </div>
      </div>
    );
  }

  const { tabs, selectedId, onSelect, caption } = props;
  const copied = copiedText !== null && copiedText === caption;
  const canCopy = caption.trim() !== "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(caption);
    } catch (e) {
      console.warn("clipboard write failed", e);
      return;
    }
    setCopiedText(caption);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopiedText(null), COPIED_MS);
  };

  const showSwitch = tabs.length >= 2;

  // Picking another draft ends the copy feedback in the same batch as the
  // selection, even when that draft's caption reads the same.
  const select = (id: string) => {
    if (id !== selectedId) setCopiedText(null);
    onSelect(id);
  };

  return (
    <div className="sp-card sp-chat-caption" data-state="ready">
      <div className="sp-chat-caption__header">
        <div className="sp-chat-caption__lead">
          <p id={titleId} className="sp-chat-caption__title">
            Caption
          </p>
          {showSwitch && (
            <SegmentSwitch
              variant="caption"
              options={tabs}
              selectedId={selectedId}
              onSelect={select}
              aria-labelledby={titleId}
            />
          )}
        </div>
        <CardAction
          action="copy"
          label="Copy caption"
          done={copied}
          disabled={!canCopy}
          onClick={() => void copy()}
        />
      </div>
      <p className="sp-chat-caption__text">{caption}</p>
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? "Caption copied" : ""}
      </span>
    </div>
  );
}
