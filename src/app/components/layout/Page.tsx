import React, { useLayoutEffect, useRef } from "react";
import { routeToUrl, useRouter } from "../../router";
import { useScrollFades } from "../generate/ScrollFade";
import { cx } from "../primitives/cx";
import { useFrameKeys } from "./useFrameKeys";

/** How a page sits in Main:
 * - "scroll", most pages: the content scrolls inside Main under an 80 fade,
 *   while the header row stays put.
 * - "self", the Generate thread and History: the content is a column as
 *   tall as Main allows, and the page scrolls its own region inside it.
 * - "bare", the builder editor: it fills Main, with no gutters and no
 *   header row. */
export type PageKind = "scroll" | "self" | "bare";

/** Main, holding one page (the app frame's Main: 13:905 and every page
 * frame of the new brand file; RULES.md section 10). At 1024 and wider the
 * header row (36 tall) sits at the top and the content under it, each the
 * full width of Main with a 32 gutter inside, and only the content scrolls.
 * Below 1024 the document scrolls and the page keeps its earlier gutters
 * (--page-pad).
 *
 * The content is `.sp-page` with the page's own layout class and state, so
 * every page rule written against `.sp-page.sp-x` still matches, and it
 * carries [data-frame-scroll] for the screenshot tool. It returns to the
 * top when the route's path changes (a new page or section); a filter in
 * the address keeps the scroll. */
export function Page({
  header,
  kind = "scroll",
  bleed,
  layout,
  children,
}: {
  /** The page's header: the PageHeader primitive, in the header row. */
  header?: React.ReactNode;
  kind?: PageKind;
  /** Mobile gutter model (2026-09): below 768 the page drops its horizontal
   *  padding so rails bleed to the screen edge, and the 16px gutter moves
   *  onto the children (see .sp-page--bleed). Brand Templates only. */
  bleed?: boolean;
  /** The page's own column class and state, set on the content. */
  layout?: { className: string; state?: string };
  children: React.ReactNode;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const { route } = useRouter();
  const path = routeToUrl(route).split("?")[0];
  const scrolls = kind === "scroll";
  const headed = Boolean(header) && kind !== "bare";

  useLayoutEffect(() => {
    if (scrolls && contentRef.current) contentRef.current.scrollTop = 0;
  }, [path, scrolls]);
  useFrameKeys(contentRef, scrolls);
  const fades = useScrollFades(contentRef);

  return (
    <div className="sp-frame" data-kind={kind} data-head={headed || undefined}>
      {headed && <div className="sp-frame__head">{header}</div>}
      <div className="sp-frame__body">
        <div
          ref={contentRef}
          className={cx("sp-page", bleed && "sp-page--bleed", layout?.className)}
          data-state={layout?.state}
          data-frame-scroll=""
        >
          {children}
        </div>
        {scrolls && (
          <div
            className="sp-frame__fade"
            data-visible={fades.bottom || undefined}
            // Clear of a classic scrollbar, as Generate's ScrollFade leaves it.
            style={
              fades.gutter
                ? ({ "--frame-fade-gutter": `${fades.gutter}px` } as React.CSSProperties)
                : undefined
            }
            aria-hidden
          />
        )}
      </div>
    </div>
  );
}
