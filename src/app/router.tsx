import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/** View-state routing, now mirrored to the URL so a view is shareable and
 * survives refresh and back/forward. Still no router dependency: one path
 * table, `history.pushState`, and a `popstate` listener.
 *
 * The Brand templates route carries its own filter state (`group`, `q`)
 * because the URL is the source of truth for that page — selecting a chip or
 * typing a query IS a navigation. `group` is a platform-and-shape id such as
 * `instagram-4-5`, which is the unit the gallery filters by. */
/** Brand Studio's categories. The studio is one autosaving page of cards
 * that open in place, so a category no longer names a separate screen — it
 * names which card is open when the page loads. The URLs are unchanged, so
 * every link that used to reach a detail route still lands on its section. */
export type BrandCategory = "colors" | "typography" | "logos" | "type-styles" | "import";
const BRAND_CATEGORIES: readonly BrandCategory[] = [
  "colors",
  "typography",
  "logos",
  "type-styles",
  "import",
];

/** Settings sections — brandStudio's category pattern, reused rather than
 * invented twice. Every section is URL-addressable (/settings/integrations
 * is a shareable link); an unknown or absent section resolves inside
 * SettingsAdmin, which also owns the role gating (Account is the one
 * section members can reach). */
export type SettingsSection =
  "workspace" | "team" | "integrations" | "usage" | "sharing" | "account" | "advanced";
const SETTINGS_SECTIONS: readonly SettingsSection[] = [
  "workspace",
  "team",
  "integrations",
  "usage",
  "sharing",
  "account",
  "advanced",
];

export type Route =
  | { name: "onboarding" }
  | { name: "portal"; group?: string; q?: string }
  | { name: "template"; templateId: string }
  /** Generate: brief in, filled templates out. `templateId` is the "use this
   * one" hint from a template card — in the URL so the intent survives a
   * refresh; the seeded VALUES deliberately do not (see seedHandoff.ts). */
  | { name: "generate"; templateId?: string }
  | { name: "adminTemplates" }
  /** `reflow` ("1080x1920") is the create-a-version handoff: the builder
   * loads the (freshly duplicated) template and reflows it to this size as
   * an unsaved change for review, then strips the param so a refresh after
   * saving cannot reflow the already-reflowed copy a second time. */
  | { name: "builder"; templateId: string | null; reflow?: string }
  | { name: "brandStudio"; category?: BrandCategory }
  | { name: "dashboard" }
  | { name: "people" }
  | { name: "settings"; section?: SettingsSection };

interface NavigateOptions {
  /** Replace the current history entry instead of pushing a new one. The
   * debounced search field uses this so typing a query doesn't bury the back
   * button under one entry per keystroke. */
  replace?: boolean;
}

interface RouterState {
  route: Route;
  navigate(route: Route, options?: NavigateOptions): void;
}

const RouterContext = createContext<RouterState | null>(null);

/** Route → URL. Keep in step with `urlToRoute`. */
export function routeToUrl(route: Route): string {
  switch (route.name) {
    case "onboarding":
      return "/onboarding";
    case "portal": {
      const params = new URLSearchParams();
      if (route.group) params.set("group", route.group);
      if (route.q) params.set("q", route.q);
      const qs = params.toString();
      return qs ? `/templates?${qs}` : "/templates";
    }
    case "template":
      return `/templates/${encodeURIComponent(route.templateId)}`;
    case "generate":
      return route.templateId
        ? `/generate?template=${encodeURIComponent(route.templateId)}`
        : "/generate";
    case "adminTemplates":
      return "/template-builder";
    case "builder": {
      const base = route.templateId
        ? `/template-builder/${encodeURIComponent(route.templateId)}`
        : "/template-builder/new";
      return route.reflow ? `${base}?reflow=${encodeURIComponent(route.reflow)}` : base;
    }
    case "brandStudio":
      return route.category ? `/brand-studio/${route.category}` : "/brand-studio";
    case "dashboard":
      return "/insights";
    case "people":
      return "/people";
    case "settings":
      return route.section ? `/settings/${route.section}` : "/settings";
  }
}

/** URL → Route. Anything unrecognised lands on the gallery rather than a
 * dead end. */
export function urlToRoute(pathname: string, search: string): Route {
  const params = new URLSearchParams(search);
  const [head, tail] = pathname.split("/").filter(Boolean);

  switch (head) {
    case "onboarding":
      return { name: "onboarding" };
    case "templates":
      if (tail) return { name: "template", templateId: decodeURIComponent(tail) };
      return {
        name: "portal",
        group: params.get("group") ?? undefined,
        q: params.get("q") ?? undefined,
      };
    case "generate":
      return { name: "generate", templateId: params.get("template") ?? undefined };
    case "template-builder":
      if (!tail) return { name: "adminTemplates" };
      return {
        name: "builder",
        templateId: tail === "new" ? null : decodeURIComponent(tail),
        reflow: params.get("reflow") ?? undefined,
      };
    case "brand-studio":
      if (tail && (BRAND_CATEGORIES as readonly string[]).includes(tail)) {
        return { name: "brandStudio", category: tail as BrandCategory };
      }
      return { name: "brandStudio" };
    case "insights":
      return { name: "dashboard" };
    case "people":
      return { name: "people" };
    case "settings":
      if (tail && (SETTINGS_SECTIONS as readonly string[]).includes(tail)) {
        return { name: "settings", section: tail as SettingsSection };
      }
      return { name: "settings" };
    default:
      return { name: "portal" };
  }
}

export function RouterProvider({ children }: { children: React.ReactNode }) {
  const [route, setRoute] = useState<Route>(() =>
    urlToRoute(window.location.pathname, window.location.search),
  );

  const navigate = useCallback((next: Route, options?: NavigateOptions) => {
    const url = routeToUrl(next);
    if (url !== window.location.pathname + window.location.search) {
      window.history[options?.replace ? "replaceState" : "pushState"](null, "", url);
    }
    setRoute(next);
  }, []);

  // Back/forward move the app without writing to history again.
  useEffect(() => {
    const onPop = () => setRoute(urlToRoute(window.location.pathname, window.location.search));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // A first load on "/" should read as the gallery in the address bar too.
  useEffect(() => {
    const canonical = routeToUrl(urlToRoute(window.location.pathname, window.location.search));
    if (window.location.pathname + window.location.search !== canonical) {
      window.history.replaceState(null, "", canonical);
    }
  }, []);

  const value = useMemo<RouterState>(() => ({ route, navigate }), [route, navigate]);
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter(): RouterState {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error("useRouter must be used inside RouterProvider");
  return ctx;
}
