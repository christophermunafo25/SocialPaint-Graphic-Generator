import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { PLATFORMS, type PlatformId } from "@/lib/templates/platforms";
import {
  INSIGHTS_METRICS,
  INSIGHTS_RANGES,
  type InsightsMetric,
  type InsightsRange,
} from "@/lib/insights/buildInsights";

/** View-state routing, now mirrored to the URL so a view is shareable and
 * survives refresh and back/forward. Still no router dependency: one path
 * table, `history.pushState`, and a `popstate` listener.
 *
 * The Brand templates route carries its own filter state (`platform`, `q`)
 * because the URL is the source of truth for that page — selecting a chip or
 * typing a query IS a navigation. `platform` is a PlatformId such as
 * `instagram`, the unit the chips filter by; an unknown value reads as no
 * filter rather than as a dead end. */
/** Brand Studio's categories. The studio is two steps (2026-09-15 frames):
 * /brand-studio is the overview grid and /brand-studio/<category> is that
 * category's detail page, edited in place and autosaving. The URLs are
 * unchanged from the accordion era, so old links still land right. The
 * `typography` key stays the Fonts page's route key (D4). */
export type BrandCategory = "colors" | "typography" | "logos" | "images" | "type-styles" | "import";
const BRAND_CATEGORIES: readonly BrandCategory[] = [
  "colors",
  "typography",
  "logos",
  "images",
  "type-styles",
  "import",
];

/** Settings sections — brandStudio's category pattern, reused rather than
 * invented twice. Every section is URL-addressable (/settings/integrations
 * is a shareable link); an unknown or absent section resolves inside
 * SettingsAdmin, which also owns the role gating (Account is the one
 * section members can reach). */
export type SettingsSection =
  "workspace" | "people" | "integrations" | "usage" | "sharing" | "account" | "advanced";
const SETTINGS_SECTIONS: readonly SettingsSection[] = [
  "workspace",
  "people",
  "integrations",
  "usage",
  "sharing",
  "account",
  "advanced",
];

export type Route =
  | { name: "onboarding" }
  | { name: "portal"; platform?: PlatformId; q?: string }
  | { name: "template"; templateId: string }
  /** Bulk fill: one published template, one CSV, one graphic per row.
   * Admin-only — App renders it through adminOnly, so a member who types
   * the URL lands on the gallery. */
  | { name: "bulk"; templateId: string }
  /** Generate, the chat (docs/design/generate-chat/PROMPT.md §11.1).
   * `/generate` is a new chat; `threadId` is a saved chat at
   * `/generate/c/<id>`. App keys the page by generatePageKey, so opening
   * another chat starts from fresh state.
   *
   * `savedInPlace` marks the chat page's own address change after it saves
   * a new chat for the first time (§9.8): the page that holds the chat is
   * still showing it, so it must not remount (generatePageKey). Never in
   * the URL: a reload, back and forward, and every other way to the chat
   * read the address alone, and so mount the saved chat afresh. */
  | { name: "generate"; threadId?: string; savedInPlace?: boolean }
  /** A template chat (docs/design/template-chat/PROMPT.md §12.1):
   * `/templates/<templateId>/chat` is a new chat on that template, and
   * `/templates/<templateId>/chat/<threadId>` a saved one. `edit` and `field`
   * open that chat's Edit details on a draft, focused on a field.
   * `savedInPlace` is the Generate route's: the page's own address change
   * after its first save, never in the URL (templateChatPageKey). */
  | {
      name: "templateChat";
      templateId: string;
      threadId?: string;
      edit?: string;
      field?: string;
      savedInPlace?: boolean;
    }
  /** Every saved chat, newest first. The filter bar's state rides in the
   * URL like the Brand templates route's: selecting a chip or typing a
   * query IS a navigation, and an unknown platform reads as no filter. */
  | { name: "generateHistory"; platform?: PlatformId; q?: string }
  | { name: "adminTemplates" }
  /** `reflow` ("1080x1920") is the create-a-version handoff: the builder
   * loads the (freshly duplicated) template and reflows it to this size as
   * an unsaved change for review, then strips the param so a refresh after
   * saving cannot reflow the already-reflowed copy a second time. */
  | { name: "builder"; templateId: string | null; reflow?: string }
  /** Two-step Brand Studio: no category is the overview, a category is
   * that detail page. `surface` is the Logos page's filter — in the URL
   * so the view is shareable, ignored on every other category. */
  | { name: "brandStudio"; category?: BrandCategory; surface?: "dark" | "light" }
  /** Insights. One date range drives every card (D2) and the trend chart's
   * selected tab rides along (D4) — both in the URL so the view is
   * shareable; the defaults (30d, exports) stay out of it. */
  | {
      name: "dashboard";
      range?: InsightsRange;
      metric?: InsightsMetric;
      /** Insights' filters (PHASE-8.md §2): a template id, a member's user
       * id or "public", a platform id. Absent means all. */
      template?: string;
      member?: string;
      platform?: PlatformId;
    }
  | { name: "settings"; section?: SettingsSection }
  /** The primitives sheet and the Figma Interaction states table
   * (docs/design/new-look/PHASE-2.md). Development builds only: urlToRoute
   * never returns it when import.meta.env.DEV is false. */
  | { name: "devUi" }
  /** The sign-in gate and onboarding without Supabase (PHASE-8B §9 D8):
   * any view or error from the address, for the screenshot run and
   * review. Development builds only, like devUi. */
  | { name: "devAuth"; view?: string; error?: string };

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
      if (route.platform) params.set("platform", route.platform);
      if (route.q) params.set("q", route.q);
      const qs = params.toString();
      return qs ? `/templates?${qs}` : "/templates";
    }
    case "template":
      return `/templates/${encodeURIComponent(route.templateId)}`;
    case "bulk":
      return `/templates/${encodeURIComponent(route.templateId)}/bulk`;
    case "templateChat": {
      const base = `/templates/${encodeURIComponent(route.templateId)}/chat`;
      const path = route.threadId ? `${base}/${encodeURIComponent(route.threadId)}` : base;
      const params = new URLSearchParams();
      if (route.edit) params.set("edit", route.edit);
      if (route.edit && route.field) params.set("field", route.field);
      const qs = params.toString();
      return qs ? `${path}?${qs}` : path;
    }
    case "generate":
      if (route.threadId) return `/generate/c/${encodeURIComponent(route.threadId)}`;
      return "/generate";
    case "generateHistory": {
      const params = new URLSearchParams();
      if (route.platform) params.set("platform", route.platform);
      if (route.q) params.set("q", route.q);
      const qs = params.toString();
      return qs ? `/generate/history?${qs}` : "/generate/history";
    }
    case "adminTemplates":
      return "/template-builder";
    case "builder": {
      const base = route.templateId
        ? `/template-builder/${encodeURIComponent(route.templateId)}`
        : "/template-builder/new";
      return route.reflow ? `${base}?reflow=${encodeURIComponent(route.reflow)}` : base;
    }
    case "brandStudio": {
      if (!route.category) return "/brand-studio";
      const base = `/brand-studio/${route.category}`;
      return route.category === "logos" && route.surface
        ? `${base}?surface=${route.surface}`
        : base;
    }
    case "dashboard": {
      const params = new URLSearchParams();
      if (route.range) params.set("range", route.range);
      if (route.metric) params.set("metric", route.metric);
      if (route.template) params.set("template", route.template);
      if (route.member) params.set("member", route.member);
      if (route.platform) params.set("platform", route.platform);
      const qs = params.toString();
      return qs ? `/insights?${qs}` : "/insights";
    }
    case "settings":
      return route.section ? `/settings/${route.section}` : "/settings";
    case "devUi":
      return "/dev/ui";
    case "devAuth": {
      const params = new URLSearchParams();
      if (route.view) params.set("view", route.view);
      if (route.error) params.set("error", route.error);
      const qs = params.toString();
      return qs ? `/dev/auth?${qs}` : "/dev/auth";
    }
  }
}

/** What App keys the Generate chat page on (PROMPT §11.1: switching chats
 * resets state). A saved chat's page is its own, keyed by its id, so
 * opening one from History or Recent, back and forward between chats, and
 * a reload each mount it fresh from the store. A new chat's page shares
 * the one key "new", including once it has saved itself and replaced the
 * address with /generate/c/<id> (`savedInPlace`): the chat is still on
 * screen, with what a remount would lose (the photo, which is never
 * stored, the open editor, the caption picks, the composer's text), so it
 * keeps the key it was mounted with. */
export function generatePageKey(route: Extract<Route, { name: "generate" }>): string {
  return route.threadId && !route.savedInPlace ? `chat:${route.threadId}` : "new";
}

/** What App keys a template chat's page on: generatePageKey's rule, per
 * template. Opening another chat starts fresh; the first save's own address
 * change (savedInPlace) and moving in and out of Edit details (`edit`,
 * `field`) keep the page mounted. */
export function templateChatPageKey(route: Extract<Route, { name: "templateChat" }>): string {
  const chat = route.threadId && !route.savedInPlace ? `chat:${route.threadId}` : "new";
  return `template:${route.templateId}:${chat}`;
}

/** The route state a navigation sets: always a fresh object, so going to
 * the address already on screen is still a change the page sees. The
 * sidebar hands over the same route object on every click, which React
 * would otherwise drop as no change at all, and a page can act on a repeat
 * visit (the sidebar's Generate from inside a chat at /generate starts a
 * new chat, as the page's route identity says). */
export function routeState(next: Route): Route {
  return { ...next };
}

const parsePlatform = (raw: string | null): PlatformId | undefined =>
  PLATFORMS.some((p) => p.id === raw) ? (raw as PlatformId) : undefined;

/** URL → Route. Anything unrecognised lands on the gallery rather than a
 * dead end. */
export function urlToRoute(pathname: string, search: string): Route {
  const params = new URLSearchParams(search);
  const [head, tail, third, fourth] = pathname.split("/").filter(Boolean);

  switch (head) {
    case "onboarding":
      return { name: "onboarding" };
    case "templates":
      if (tail && third === "bulk") return { name: "bulk", templateId: decodeURIComponent(tail) };
      if (tail && third === "chat") {
        const edit = params.get("edit") ?? undefined;
        const field = edit ? (params.get("field") ?? undefined) : undefined;
        return {
          name: "templateChat",
          templateId: decodeURIComponent(tail),
          ...(fourth ? { threadId: decodeURIComponent(fourth) } : {}),
          ...(edit ? { edit } : {}),
          ...(field ? { field } : {}),
        };
      }
      if (tail) return { name: "template", templateId: decodeURIComponent(tail) };
      return {
        name: "portal",
        platform: parsePlatform(params.get("platform")),
        q: params.get("q") ?? undefined,
      };
    case "generate":
      if (tail === "history") {
        return {
          name: "generateHistory",
          platform: parsePlatform(params.get("platform")),
          q: params.get("q") ?? undefined,
        };
      }
      // A chat's own address. A bare /generate/c (no id) is a new chat.
      if (tail === "c" && third) return { name: "generate", threadId: decodeURIComponent(third) };
      return { name: "generate" };
    case "template-builder":
      if (!tail) return { name: "adminTemplates" };
      return {
        name: "builder",
        templateId: tail === "new" ? null : decodeURIComponent(tail),
        reflow: params.get("reflow") ?? undefined,
      };
    case "brand-studio":
      if (tail && (BRAND_CATEGORIES as readonly string[]).includes(tail)) {
        const category = tail as BrandCategory;
        const rawSurface = params.get("surface");
        // The filter belongs to Logos alone; an unknown value reads as no
        // filter rather than as a dead end.
        const surface =
          category === "logos" && (rawSurface === "dark" || rawSurface === "light")
            ? rawSurface
            : undefined;
        return { name: "brandStudio", category, surface };
      }
      return { name: "brandStudio" };
    case "insights": {
      // The brandStudio `surface` pattern: an unknown value reads as the
      // default rather than as a dead end, and defaults stay off the URL.
      const rawRange = params.get("range");
      const rawMetric = params.get("metric");
      return {
        name: "dashboard",
        range: (INSIGHTS_RANGES as readonly string[]).includes(rawRange ?? "")
          ? (rawRange as InsightsRange)
          : undefined,
        metric: (INSIGHTS_METRICS as readonly string[]).includes(rawMetric ?? "")
          ? (rawMetric as InsightsMetric)
          : undefined,
        // Ids are checked against the workspace's own templates and members
        // on the page; an unknown one reads as "all" there.
        template: params.get("template") || undefined,
        member: params.get("member") || undefined,
        platform: PLATFORMS.some((p) => p.id === params.get("platform"))
          ? (params.get("platform") as PlatformId)
          : undefined,
      };
    }
    // People lives in Settings (new look, Phase 3). The old addresses land
    // on its section; RouterProvider rewrites the address bar to match.
    case "people":
      return { name: "settings", section: "people" };
    case "settings":
      if (tail === "team") return { name: "settings", section: "people" };
      if (tail && (SETTINGS_SECTIONS as readonly string[]).includes(tail)) {
        return { name: "settings", section: tail as SettingsSection };
      }
      return { name: "settings" };
    case "dev":
      // Read at call time so a test can stub it; a production build
      // replaces it with false and drops this branch.
      if (import.meta.env.DEV && tail === "ui") return { name: "devUi" };
      if (import.meta.env.DEV && tail === "auth") {
        return {
          name: "devAuth",
          view: params.get("view") ?? undefined,
          error: params.get("error") ?? undefined,
        };
      }
      return { name: "portal" };
    default:
      return { name: "portal" };
  }
}

const HISTORY_SAVED_IN_PLACE = { savedInPlace: true } as const;

/** A route read back from a history entry, with the savedInPlace mark the
 * entry was written with (navigate). Only a chat's own address takes it. */
export function withHistoryState(route: Route, state: unknown): Route {
  const marked =
    typeof state === "object" &&
    state !== null &&
    (state as { savedInPlace?: unknown }).savedInPlace === true;
  if (!marked) return route;
  if ((route.name === "generate" || route.name === "templateChat") && route.threadId) {
    return { ...route, savedInPlace: true };
  }
  return route;
}

/** The routes only admins reach. A member who opens one sees the gallery,
 * with the address left as it is (App.tsx). Settings is not among them: it
 * gates its own sections (settingsSections.ts). */
const ADMIN_ONLY: ReadonlySet<Route["name"]> = new Set([
  "bulk",
  "adminTemplates",
  "builder",
  "brandStudio",
  "dashboard",
]);

/** The screen a route shows for a role: the route's own, or the gallery for
 * a member on an admin-only route. */
export function screenFor(route: Route, role: "admin" | "member"): Route["name"] {
  return role !== "admin" && ADMIN_ONLY.has(route.name) ? "portal" : route.name;
}

export function RouterProvider({ children }: { children: React.ReactNode }) {
  const [route, setRoute] = useState<Route>(() =>
    urlToRoute(window.location.pathname, window.location.search),
  );

  const navigate = useCallback((next: Route, options?: NavigateOptions) => {
    const url = routeToUrl(next);
    // savedInPlace never reaches the URL, but it rides in the history entry,
    // so back and forward within a chat saved in place (Edit details' own
    // entries) find the page they left and do not remount it.
    const state = "savedInPlace" in next && next.savedInPlace ? HISTORY_SAVED_IN_PLACE : null;
    if (url !== window.location.pathname + window.location.search) {
      window.history[options?.replace ? "replaceState" : "pushState"](state, "", url);
    } else if (state) {
      window.history.replaceState(state, "", url);
    }
    setRoute(routeState(next));
  }, []);

  // Back/forward move the app without writing to history again.
  useEffect(() => {
    const onPop = () => {
      const next = urlToRoute(window.location.pathname, window.location.search);
      // An old address in history (/people) reads as its new one.
      const canonical = routeToUrl(next);
      if (window.location.pathname + window.location.search !== canonical) {
        window.history.replaceState(window.history.state, "", canonical);
      }
      setRoute(withHistoryState(next, window.history.state));
    };
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
