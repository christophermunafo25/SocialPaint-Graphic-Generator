import React, { useLayoutEffect, useRef } from "react";
import { routeToUrl, useRouter } from "../../router";
import { FooterLinks } from "../primitives/PageHeader";
import { cx } from "../primitives/cx";
import { useFrameKeys } from "./useFrameKeys";

/** How a page sits in Main:
 * - "scroll", most pages: the header row, the content and the footer links
 *   scroll inside Main as one page. Nothing sticks (CJ, 2026-11-16).
 * - "self", the Generate thread and History: the content is a column as
 *   tall as Main allows, and the page scrolls its own region inside it.
 * - "bare", the builder editor: it fills Main, with no gutters, header row
 *   or footer (its frames draw none). */
export type PageKind = "scroll" | "self" | "bare";

/** Main, holding one page (the app frame's Main: 13:905 and every page
 * frame of the new brand file; RULES.md section 10). At 1024 and wider the
 * header row (36 tall) sits at the top, the content under it and the
 * footer links at the foot, each the full width of Main with a 32 gutter
 * inside, and the three scroll together inside the frame. Below 1024 the
 * document scrolls, the page keeps its earlier gutters (--page-pad) and
 * the links follow the content.
 *
 * The content is `.sp-page` with the page's own layout class and state, so
 * every page rule written against `.sp-page.sp-x` still matches. The
 * frame carries [data-frame-scroll] for the screenshot tool. It returns to
 * the top when the route's path changes (a new page or section); a filter
 * in the address keeps the scroll. */
export function Page({
  header,
  kind = "scroll",
  footer = true,
  bleed,
  layout,
  children,
}: {
  /** The page's header: the PageHeader primitive, in the header row. */
  header?: React.ReactNode;
  kind?: PageKind;
  /** Terms of Service and Privacy Policy at Main's foot (4015:750). Off
   * where the page sets them itself: the fill page puts them under its
   * stage, as the public link page needs them too. */
  footer?: boolean;
  /** Mobile gutter model (2026-09): below 768 the page drops its horizontal
   *  padding so rails bleed to the screen edge, and the 16px gutter moves
   *  onto the children (see .sp-page--bleed). Brand Templates only. */
  bleed?: boolean;
  /** The page's own column class and state, set on the content. */
  layout?: { className: string; state?: string };
  children: React.ReactNode;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const { route } = useRouter();
  const path = routeToUrl(route).split("?")[0];
  const scrolls = kind === "scroll";
  const headed = Boolean(header) && kind !== "bare";
  const footed = footer && kind !== "bare";

  useLayoutEffect(() => {
    if (scrolls && frameRef.current) frameRef.current.scrollTop = 0;
  }, [path, scrolls]);
  useFrameKeys(frameRef, scrolls);

  return (
    <div
      ref={frameRef}
      className="sp-frame"
      data-kind={kind}
      data-head={headed || undefined}
      data-foot={footed || undefined}
      data-frame-scroll=""
    >
      {headed && <div className="sp-frame__head">{header}</div>}
      <div className="sp-frame__body">
        <div
          className={cx("sp-page", bleed && "sp-page--bleed", layout?.className)}
          data-state={layout?.state}
        >
          {children}
        </div>
      </div>
      {footed && (
        <footer className="sp-frame__foot">
          <FooterLinks />
        </footer>
      )}
    </div>
  );
}
