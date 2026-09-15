import type React from "react";
import { useRouter, type Route } from "../../../router";

/** In-app navigation on a REAL anchor: cmd/ctrl/shift/middle clicks fall
 * through to the browser (new tab, new window), an unmodified primary
 * click becomes a pushState navigation. The href comes from routeToUrl at
 * the call site, so the link works with JavaScript disabled too. */
export function useLinkClick() {
  const { navigate } = useRouter();
  return (route: Route) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(route);
  };
}
