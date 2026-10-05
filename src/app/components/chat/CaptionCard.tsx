import React, { useEffect, useId, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { IconButton, SegmentedControl, type SegmentOption } from "../primitives";

/** How long Copy shows its check after a write lands. */
const COPIED_MS = 1500;

/**
 * The caption card under a chat's results (the template chat's 13:7920;
 * Generate's 13:3111): "Caption", a switch between the drafts when there
 * are two or more (Generate; one tab per draft, by platform), Copy, then
 * the caption as written (line breaks kept).
 *
 * Copy's feedback belongs to the text it copied: it shows a check and says
 * "Caption copied" for 1.5s, and any change to the visible caption (another
 * draft picked, an edit, a regenerate) drops it at once, so coming back to
 * the copied text within the 1.5s neither shows the check nor announces a
 * copy that did not happen. A denied write claims nothing.
 */
export function CaptionCard({
  caption,
  tabs,
  selectedId,
  onSelect,
}: {
  caption: string;
  /** One per draft; the switch shows for two or more. */
  tabs?: SegmentOption[];
  selectedId?: string | null;
  onSelect?(id: string): void;
}) {
  const titleId = useId();
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  // During render, so neither the glyph nor the live region shows a copy
  // against other text for a frame.
  if (copied !== null && copied !== caption) setCopied(null);
  const shown = copied !== null;
  const showSwitch = Boolean(tabs && tabs.length >= 2 && onSelect);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(caption);
    } catch (e) {
      console.warn("clipboard write failed", e);
      return;
    }
    setCopied(caption);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(null), COPIED_MS);
  };

  return (
    <div className="sp-tchat-caption">
      <div className="sp-tchat-caption__head">
        {showSwitch ? (
          <div className="sp-tchat-caption__lead">
            <span id={titleId} className="t-label-m">
              Caption
            </span>
            <SegmentedControl
              options={tabs!}
              selectedId={selectedId ?? null}
              onSelect={(id) => {
                if (id !== selectedId) setCopied(null);
                onSelect!(id);
              }}
              aria-labelledby={titleId}
              className="sp-tchat-caption__switch"
            />
          </div>
        ) : (
          <span className="t-label-m">Caption</span>
        )}
        <IconButton
          icon={shown ? Check : Copy}
          label={shown ? "Caption copied" : "Copy caption"}
          disabled={!caption.trim()}
          onClick={() => void copy()}
        />
      </div>
      <p className="t-body-m sp-tchat-caption__text">{caption}</p>
      <span className="sr-only" role="status">
        {shown ? "Caption copied" : ""}
      </span>
    </div>
  );
}

/** The caption card while the drafts build (13:2795): its shape as plain
 * sunken wells (PHASE-5 §9 D12): a title bar, the switch's block when
 * more than one draft is coming, the copy circle, then two lines.
 * Decoration only; the status sentence carries the progress. */
export function CaptionCardSkeleton({ withSwitch = false }: { withSwitch?: boolean }) {
  return (
    <div className="sp-tchat-caption sp-tchat-skeleton" aria-hidden>
      <div className="sp-tchat-caption__head">
        <span className="sp-tchat-caption__lead">
          <span className="sp-tchat-skeleton__bar" style={{ width: 56 }} />
          {withSwitch && <span className="sp-tchat-skeleton__switch" />}
        </span>
        <span className="sp-tchat-skeleton__circle" />
      </div>
      <span className="sp-tchat-skeleton__lines">
        <span className="sp-tchat-skeleton__bar" style={{ width: "100%", height: 12 }} />
        <span className="sp-tchat-skeleton__bar" style={{ width: "50%", height: 12 }} />
      </span>
    </div>
  );
}
