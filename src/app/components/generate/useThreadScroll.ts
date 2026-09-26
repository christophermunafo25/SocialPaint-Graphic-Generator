import { useCallback, useLayoutEffect, useRef, useState } from "react";

/** How close to the bottom still counts as reading the latest turn
 * (PROMPT §8.4). */
const FOLLOW_PX = 80;

/** How far off the latest turn's head still counts as holding at it: the
 * browser keeps whole-pixel scroll positions, so a head at 71.5 is held at
 * 72, and that rounding must never read as the member scrolling on. */
const HOLD_PX = 2;

/** The chat thread's scrolling (PROMPT §8.4): the thread follows new
 * content while the member is within 80px of the bottom, and leaves their
 * position alone once they have scrolled up to read. `follow()` re-arms it
 * for content the member asked for themselves (a send, a Try next chip, Try
 * again), so their own message never lands out of view.
 *
 * Following never scrolls the head of the latest turn (the byline, the
 * status sentence and the progress row) up under the top fade: when a turn
 * grows taller than the thread (three variations, or cards wrapping on a
 * narrow window), the view stops with that head just under the fade, and
 * the rest of the turn is a scroll away. The line is the scroller's
 * `scroll-padding-top` (the fade's depth plus a focus ring, in the CSS), so
 * a turn's head and a focused control stop in the same place. Holding at
 * that line counts as following, so the turn can keep growing below it
 * without the view jumping; a member who scrolls on past it to the latest
 * lines is followed to the bottom as before.
 *
 * `follow()` is a promise about the next layout, not a flag the next scroll
 * event can take back: the thread's following settles on the new turn's
 * head once its content lands, whatever the last turn ended as and
 * wherever the view was. The browser's scroll anchoring is off on the
 * scroller (in the CSS) for the same reason: this hook owns the position.
 *
 * It also reports the thread column's width, which a wide draft card must
 * fit (DraftCard's `maxWidth`): 760 beside the rail, less on a narrow
 * window.
 *
 * `preserve(el)` is for a change the member made to the layout rather
 * than to the content (the editor opening or closing, which narrows the
 * column and swaps every card's size): the element keeps its place on
 * screen through the reflow, whatever following would have done, so the
 * member is left looking at what they were looking at. Call it before the
 * change commits; it holds for the layout passes that change sets off (the
 * column's new width re-sizes the cards a second time) and lapses two
 * frames after the last one. Following then goes by where that leaves the
 * view.
 *
 * `active` is whether the thread is on screen; the refs attach to the
 * scroller and to the column inside it, whose last child is the latest
 * turn. A thread that appears starts where following would put it.
 * Scrolling is instant, so reduced motion needs nothing more. */
export function useThreadScroll(active: boolean) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const columnRef = useRef<HTMLDivElement | null>(null);
  const following = useRef(true);
  // A follow() waiting for the layout of the content it was called for.
  const pending = useRef(false);
  // A preserve() holding an element in place: where it stood on screen
  // (its top in the window, since the scroller itself can move when the
  // layout changes), and the frame that lets it lapse.
  const anchor = useRef<{ el: Element; top: number; lapse: number } | null>(null);
  const [columnWidth, setColumnWidth] = useState<number | undefined>(undefined);

  useLayoutEffect(() => {
    if (!active) return;
    const scroller = scrollRef.current;
    const column = columnRef.current;
    if (!scroller || !column) return;
    // Where the fade ends, from the CSS: constant for the scroller's life.
    const inset = parseFloat(getComputedStyle(scroller).scrollPaddingTop) || 0;
    /** The furthest down following goes: the bottom, or the scroll position
     * that puts the latest turn's head at the fade's edge, whichever is
     * higher. */
    const target = () => {
      const max = scroller.scrollHeight - scroller.clientHeight;
      const latest = column.lastElementChild;
      if (!latest) return max;
      const top =
        latest.getBoundingClientRect().top -
        scroller.getBoundingClientRect().top +
        scroller.scrollTop;
      // Whole pixels, as the browser keeps them.
      return Math.max(0, Math.round(Math.min(max, top - inset)));
    };
    /** Moves to the latest. `toHead` is for a follow(): the new turn's head,
     * wherever the view was. */
    const settle = (toHead = false) => {
      const at = target();
      // Already below the head (the member scrolled on to the latest lines
      // themselves): hold the bottom, never pull them back up.
      const below = !toHead && scroller.scrollTop > at + HOLD_PX;
      scroller.scrollTop = below ? scroller.scrollHeight : at;
    };
    /** Whether the view is at the latest: near the bottom, or holding at
     * the latest turn's head. */
    const atLatest = () => {
      const fromBottom = scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop;
      return fromBottom <= FOLLOW_PX || Math.abs(scroller.scrollTop - target()) <= HOLD_PX;
    };
    // Scroll events come from the member and from settle alike; either way
    // the position says whether they are still at the latest. A follow()
    // waiting on its layout stands whatever the position says in the
    // meantime.
    const onScroll = () => {
      if (pending.current) return;
      following.current = atLatest();
    };
    /** Puts a preserve()d element back where it stood, and lets the anchor
     * lapse two frames after this layout unless another one needs it. */
    const hold = (held: { el: Element; top: number; lapse: number }) => {
      if (held.el.isConnected) {
        scroller.scrollTop += held.el.getBoundingClientRect().top - held.top;
      }
      following.current = atLatest();
      cancelAnimationFrame(held.lapse);
      held.lapse = requestAnimationFrame(() => {
        held.lapse = requestAnimationFrame(() => {
          if (anchor.current === held) anchor.current = null;
        });
      });
    };
    // The column grows as drafts land and captions fill in, and the
    // scroller shrinks when the dock grows or the window does: either way,
    // hold the latest if the member was there. The first layout after a
    // follow() lands the member's own content, so it settles on the new
    // turn's head.
    // A preserve() outranks both: the member changed the layout, not the
    // content, and stays where they were.
    const ro = new ResizeObserver(() => {
      setColumnWidth(column.clientWidth);
      const held = anchor.current;
      if (held) {
        pending.current = false;
        hold(held);
        return;
      }
      const followed = pending.current;
      pending.current = false;
      if (followed) following.current = true;
      if (following.current) settle(followed);
    });
    ro.observe(column);
    ro.observe(scroller);
    scroller.addEventListener("scroll", onScroll, { passive: true });
    following.current = true;
    setColumnWidth(column.clientWidth);
    settle();
    return () => {
      ro.disconnect();
      scroller.removeEventListener("scroll", onScroll);
      if (anchor.current) cancelAnimationFrame(anchor.current.lapse);
      anchor.current = null;
    };
  }, [active]);

  const follow = useCallback(() => {
    following.current = true;
    pending.current = true;
  }, []);

  const preserve = useCallback((el: Element | null | undefined) => {
    const scroller = scrollRef.current;
    if (!scroller || !el || !scroller.contains(el)) return;
    if (anchor.current) cancelAnimationFrame(anchor.current.lapse);
    // No layout may follow (nothing changed size), so the anchor lapses on
    // its own as well.
    const held = { el, top: el.getBoundingClientRect().top, lapse: 0 };
    held.lapse = requestAnimationFrame(() => {
      held.lapse = requestAnimationFrame(() => {
        if (anchor.current === held) anchor.current = null;
      });
    });
    anchor.current = held;
  }, []);

  return { scrollRef, columnRef, columnWidth, follow, preserve };
}
