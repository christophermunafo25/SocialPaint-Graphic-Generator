import React from "react";
import { PRIVACY_URL, TERMS_URL } from "@/lib/legalLinks";
import { cx, type IconComponent } from "./cx";

export interface Crumb {
  label: string;
  /** Where the crumb goes. The last crumb is the page itself and has none. */
  onClick?(): void;
  /** With an address, the crumb is a real link: a plain click runs
   * `onClick` in place, and a modified or middle click is the browser's
   * (a new tab or window). */
  href?: string;
}

const isPlainClick = (e: React.MouseEvent) =>
  !e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

export interface BreadcrumbProps {
  crumbs: Crumb[];
  /** The id of the last crumb, which names the page and is its heading. */
  currentId?: string;
  /** Whether the last crumb is the page's heading (it is, unless the page
   * sets its own title under the trail, as History does). */
  currentIsHeading?: boolean;
  className?: string;
}

/** Breadcrumb (Figma 2213:111): the trail in Label/M, 8 apart. Earlier
 * crumbs are links on text/secondary with a slash between them; the last
 * names the page, on text/primary, and is its heading. */
export function Breadcrumb({
  crumbs,
  currentId,
  currentIsHeading = true,
  className,
}: BreadcrumbProps) {
  const last = crumbs.length - 1;
  const Current = currentIsHeading ? "h1" : "span";
  return (
    <nav aria-label="Breadcrumb" className={cx("ui-breadcrumb", className)}>
      <ol>
        {crumbs.map((crumb, i) => (
          <li key={`${i}-${crumb.label}`}>
            {i > 0 && (
              <span className="t-label-m ui-breadcrumb__divider" aria-hidden>
                /
              </span>
            )}
            {i === last ? (
              <Current
                id={currentId}
                className="t-label-m ui-breadcrumb__current"
                aria-current="page"
              >
                {crumb.label}
              </Current>
            ) : crumb.href ? (
              <a
                href={crumb.href}
                className="ui-reset ui-ring t-label-m ui-breadcrumb__link"
                onClick={(e) => {
                  if (!isPlainClick(e)) return;
                  e.preventDefault();
                  crumb.onClick?.();
                }}
              >
                {crumb.label}
              </a>
            ) : (
              <button
                type="button"
                className="ui-reset ui-ring t-label-m ui-breadcrumb__link"
                onClick={crumb.onClick}
              >
                {crumb.label}
              </button>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

interface PageHeaderShared {
  /** The area's icon, at 18 on text/secondary before the title or the
   * trail, hidden from assistive tech. A page one level down takes its
   * parent area's (areas.ts). */
  icon?: IconComponent;
  /** The page's actions, on the right, 8 apart. */
  actions?: React.ReactNode;
  /** A quiet line before the actions, in Body/S (a detail page's save
   * status), read out politely as it changes. */
  status?: React.ReactNode;
  className?: string;
}

export type PageHeaderProps = PageHeaderShared &
  (
    | {
        /** Title kind: the page's name, in Label/M on text/secondary. */
        title: React.ReactNode;
        /** False when the page sets its own heading under the header row
         * (Generate Start's greeting), so the title is not a second h1. */
        titleIsHeading?: boolean;
        crumbs?: undefined;
        currentId?: undefined;
        currentIsHeading?: undefined;
      }
    | {
        title?: undefined;
        titleIsHeading?: undefined;
        /** Breadcrumb kind: the trail in place of a title. */
        crumbs: Crumb[];
        /** The page heading's id, for a region it names. */
        currentId?: string;
        /** False when the page sets its own title under the trail. */
        currentIsHeading?: boolean;
      }
  );

/** Page header (Figma 4015:764): one row 36 tall, in the frame's 64 header
 * row. The area's icon leads, then the title or the breadcrumb, 8 apart;
 * the page's actions sit on the right. The title or the breadcrumb's last
 * crumb is the page's heading. */
export const PageHeader = React.forwardRef<HTMLElement, PageHeaderProps>(function PageHeader(
  {
    icon: Icon,
    title,
    titleIsHeading = true,
    crumbs,
    currentId,
    currentIsHeading,
    actions,
    status,
    className,
  },
  ref,
) {
  const Title = titleIsHeading ? "h1" : "p";
  return (
    <header ref={ref} className={cx("ui-page-header", className)}>
      <div className="ui-page-header__lead">
        {Icon && (
          <Icon size={18} strokeWidth={1.5} className="ui-icon ui-page-header__icon" aria-hidden />
        )}
        {crumbs ? (
          <Breadcrumb crumbs={crumbs} currentId={currentId} currentIsHeading={currentIsHeading} />
        ) : (
          <Title className="t-label-m ui-page-header__title">{title}</Title>
        )}
      </div>
      {(status || actions) && (
        <div className="ui-page-header__end">
          {status && (
            <span className="t-body-s ui-page-header__status" role="status">
              {status}
            </span>
          )}
          {actions && <div className="ui-page-header__actions">{actions}</div>}
        </div>
      )}
    </header>
  );
});

/** Footer links (Figma 4015:750): Terms of Service and Privacy Policy in
 * Caption/M, 16 apart and centered. They leave the app, so they open in a
 * new tab with the opener cut. */
export function FooterLinks({ className }: { className?: string }) {
  return (
    <div className={cx("ui-footer-links", className)}>
      <a
        className="ui-reset ui-ring t-caption-m ui-footer-links__link"
        href={TERMS_URL}
        target="_blank"
        rel="noopener noreferrer"
      >
        Terms of Service
      </a>
      <a
        className="ui-reset ui-ring t-caption-m ui-footer-links__link"
        href={PRIVACY_URL}
        target="_blank"
        rel="noopener noreferrer"
      >
        Privacy Policy
      </a>
    </div>
  );
}
