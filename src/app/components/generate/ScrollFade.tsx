import React from "react";

/** The soft edge where a scrolling region meets fixed chrome (sp-scroll-fade
 * 341:813, Position Top / Bottom): 56 tall unless its frame sets
 * --chat-fade-top or --chat-fade-bottom, full width, pointer-transparent. The page ground ramps from solid
 * at the pinned edge to nothing, and a backdrop blur eases out along the
 * same direction, so content reads as sliding under the header rather
 * than being cut off by it. `visible` fades it in and out over
 * --dur-state (zeroed under reduced motion).
 *
 * Placement: it is absolutely positioned, so put it in a non-scrolling
 * `position: relative` frame BESIDE the scrolling element, not inside it
 * (an absolute child of the scroller travels with the content; PROMPT's
 * "inside the scroll container" means over it). The frame should match the
 * scroller's box. Drive `visible` from useScrollFades on that scroller and
 * pass its `gutter`, so the fade stops short of a classic scrollbar
 * instead of veiling the thumb and arrows at that end. */
export function ScrollFade({
  position,
  visible,
  gutter = 0,
}: {
  position: "top" | "bottom";
  visible: boolean;
  /** The scroller's scrollbar width in px (useScrollFades' `gutter`),
   * left clear at the inline end. 0 for an overlay scrollbar. */
  gutter?: number;
}) {
  return (
    <div
      className="sp-chat-scroll-fade"
      data-position={position}
      data-visible={visible || undefined}
      style={
        gutter ? ({ "--scroll-fade-gutter": `${gutter}px` } as React.CSSProperties) : undefined
      }
      aria-hidden
    />
  );
}
