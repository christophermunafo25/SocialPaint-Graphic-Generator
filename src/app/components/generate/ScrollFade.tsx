import React, { useEffect, useLayoutEffect, useState } from "react";

/** The soft edge where a scrolling region meets fixed chrome (Figma
 * "Generate · Chat", sp-scroll-fade 341:813, Position Top / Bottom): 56
 * tall, full width, pointer-transparent. The page ground ramps from solid
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

type Fades = { top: boolean; bottom: boolean; gutter: number };
const NONE: Fades = { top: false, bottom: false, gutter: 0 };

/** Which edges of a vertical scroller have content hidden past them: `top`
 * once it is scrolled at all, `bottom` while more lies below; and `gutter`,
 * the width its scrollbar takes from the box (0 for overlay scrollbars),
 * for ScrollFade to leave clear. Listens to scroll and to size changes of
 * the scroller and of its children (content that grows inside an
 * unchanged box changes scrollHeight, which a ResizeObserver on the
 * scroller alone misses; see useEdgeFade). A scrollbar appearing shrinks
 * the scroller's content box, so the same observer catches the gutter.
 *
 * The hook follows whatever element `ref` holds after each render of its
 * owner, so it may be called before the scroller exists: a page that goes
 * from the Start state (no thread) to the thread subscribes the render the
 * thread mounts, with no deps to remember. `deps` re-measures on changes
 * that neither resize a child nor re-render the owner. */
export function useScrollFades(
  ref: React.RefObject<HTMLElement | null>,
  deps: unknown[] = [],
): Fades {
  const [fades, setFades] = useState(NONE);
  const [el, setEl] = useState<HTMLElement | null>(null);

  // No deps on purpose: a ref changing never re-renders, so check it after
  // every commit (one comparison) and re-render only when it moved. The
  // guard settles on the next pass, so the update chain the rule warns of
  // cannot form.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
  useLayoutEffect(() => {
    if (ref.current !== el) setEl(ref.current);
  });

  useEffect(() => {
    if (!el) {
      setFades(NONE);
      return;
    }
    // Only a resize can move the gutter, so scrolling skips the style read.
    let gutter = 0;
    const measureGutter = () => {
      // offsetWidth counts the borders and the scrollbar, clientWidth neither.
      const cs = getComputedStyle(el);
      const borders = parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
      const taken = Math.max(0, el.offsetWidth - el.clientWidth - borders);
      // `scrollbar-gutter: stable both-edges` reserves the scrollbar's width
      // on the other edge too; only one of the two holds the scrollbar.
      gutter = cs.scrollbarGutter.includes("both-edges") ? taken / 2 : taken;
    };
    const measure = () => {
      const top = el.scrollTop > 0;
      // 1px of slack: fractional zoom leaves scrollTop a hair short of max.
      const bottom = el.scrollHeight - el.clientHeight - el.scrollTop > 1;
      setFades((prev) =>
        prev.top === top && prev.bottom === bottom && prev.gutter === gutter
          ? prev
          : { top, bottom, gutter },
      );
    };
    const ro = new ResizeObserver(() => {
      measureGutter();
      measure();
    });
    const observe = () => {
      ro.disconnect();
      ro.observe(el);
      for (const child of Array.from(el.children)) ro.observe(child);
    };
    const mo = new MutationObserver(() => {
      observe();
      measure();
    });
    observe();
    mo.observe(el, { childList: true });
    el.addEventListener("scroll", measure, { passive: true });
    measureGutter();
    measure();
    return () => {
      el.removeEventListener("scroll", measure);
      ro.disconnect();
      mo.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [el, ...deps]);

  return fades;
}
