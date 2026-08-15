import React, { useId, useLayoutEffect, useRef } from "react";

/** The active-nav pill, flowing between rows like liquid — the BYQ Supply
 * "Gooey Nav Indicator" gem turned vertical and bound to the ACTIVE row
 * only (nav hover stays neutral, at Chris's direction). Motion values are
 * verbatim from the gem per its integration licence: blob travel 0.55s on
 * the standard exit curve, the trailing drop 0.62s on an overshoot spring
 * with a 260ms settle, fused by the goo filter (blur 7 → alpha threshold).
 *
 * The pill is SOLID Voltage with ink content in both themes — a fill, so
 * it is light-theme legal — because the goo filter's alpha threshold
 * crushes translucent fills; the old wash treatment could not travel.
 *
 * Renders inside a positioned container holding `[data-active="true"]`
 * nav buttons; the buttons must sit above it (z-index 1). */
export function GooeyNavPill({
  containerRef,
  watch,
}: {
  containerRef: React.RefObject<HTMLElement | null>;
  /** Re-measure when this changes (active route, collapsed state). */
  watch: unknown;
}) {
  const blobRef = useRef<HTMLSpanElement>(null);
  const dropRef = useRef<HTMLSpanElement>(null);
  const settleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstRef = useRef(true);
  const filterId = useId().replace(/[^a-zA-Z0-9_-]/g, "") + "-goo";

  useLayoutEffect(() => {
    const container = containerRef.current;
    const blob = blobRef.current;
    const drop = dropRef.current;
    if (!container || !blob || !drop) return;

    const move = (animate: boolean) => {
      const active = container.querySelector<HTMLElement>('[data-active="true"]');
      if (!active) {
        blob.style.opacity = "0";
        return;
      }
      blob.style.opacity = "1";
      const cRect = container.getBoundingClientRect();
      const r = active.getBoundingClientRect();
      const x = r.left - cRect.left;
      const y = r.top - cRect.top;
      blob.style.setProperty("--x", `${x}px`);
      blob.style.setProperty("--y", `${y}px`);
      blob.style.setProperty("--w", `${r.width}px`);
      blob.style.setProperty("--h", `${r.height}px`);

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (settleRef.current !== null) {
        clearTimeout(settleRef.current);
        settleRef.current = null;
      }
      drop.style.setProperty("--dx", `${x + r.width / 2}px`);
      drop.style.setProperty("--dy", `${y + r.height / 2}px`);
      if (animate && !reduced) {
        drop.style.setProperty("--ds", "1");
        settleRef.current = setTimeout(() => {
          drop.style.setProperty("--ds", "0");
          settleRef.current = null;
        }, 260);
      } else {
        drop.style.setProperty("--ds", "0");
      }
    };

    move(!firstRef.current);
    firstRef.current = false;
    // The sidebar's own width transition (collapse/expand) moves the rows
    // AFTER this effect measures — re-measure once the panel settles.
    const settle = setTimeout(() => move(false), 420);
    const onResize = () => move(false);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      clearTimeout(settle);
      if (settleRef.current !== null) clearTimeout(settleRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- watch drives re-measure
  }, [watch, containerRef]);

  return (
    <>
      <span aria-hidden className="sp-goo" style={{ filter: `url(#${filterId})` }}>
        <span ref={blobRef} className="sp-goo__blob" />
        <span ref={dropRef} className="sp-goo__drop" />
      </span>
      <svg
        aria-hidden
        focusable={false}
        width="0"
        height="0"
        style={{ position: "absolute", width: 0, height: 0, pointerEvents: "none" }}
      >
        <defs>
          <filter id={filterId}>
            <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -10"
            />
          </filter>
        </defs>
      </svg>
    </>
  );
}
