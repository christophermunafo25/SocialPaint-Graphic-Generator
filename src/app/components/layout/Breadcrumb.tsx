import React from "react";

export interface Crumb {
  label: string;
  /** Where the crumb goes. The last crumb is the page itself and has none. */
  onClick?(): void;
}

/** The page header with a breadcrumb in place of the title (new look,
 * 156:748; the template chat and Generate use it too): the trail on the
 * left, 8 apart, the page's actions on the right. Earlier crumbs are links
 * in Label/M on text/secondary; the last names the page, in text/strong,
 * and is its heading. */
export const BreadcrumbHeader = React.forwardRef<
  HTMLElement,
  {
    crumbs: Crumb[];
    actions?: React.ReactNode;
    /** The page heading's id, for a region it names (the chat's log). */
    currentId?: string;
  }
>(function BreadcrumbHeader({ crumbs, actions, currentId }, ref) {
  const last = crumbs.length - 1;
  return (
    <header ref={ref} className="sp-shell-pagehead">
      <nav aria-label="Breadcrumb" className="sp-shell-crumbs">
        <ol>
          {crumbs.map((crumb, i) => (
            <li key={`${i}-${crumb.label}`}>
              {i > 0 && (
                <span className="t-body-s sp-shell-crumbs__sep" aria-hidden>
                  /
                </span>
              )}
              {i === last ? (
                <h1
                  id={currentId}
                  className="t-label-m sp-shell-crumbs__current"
                  aria-current="page"
                >
                  {crumb.label}
                </h1>
              ) : (
                <button
                  type="button"
                  className="ui-reset ui-ring t-label-m sp-shell-crumbs__link"
                  onClick={crumb.onClick}
                >
                  {crumb.label}
                </button>
              )}
            </li>
          ))}
        </ol>
      </nav>
      {actions && <div className="sp-shell-pagehead__actions">{actions}</div>}
    </header>
  );
});
