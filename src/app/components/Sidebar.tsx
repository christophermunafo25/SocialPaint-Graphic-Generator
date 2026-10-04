import React, { useEffect, useState } from "react";
import {
  BarChart3,
  Frame,
  Paintbrush,
  PanelLeft,
  PencilRuler,
  Settings,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useColorScheme } from "@/lib/colorScheme";
import { useRouter, type Route } from "../router";
import { useChrome } from "./layout/ChromeContext";
import { BrandLockup, BrandMark } from "./BrandMark";
import { Tooltip } from "./Tooltip";
import { Avatar, IconButton, NavItem, ThemeToggle } from "./primitives";

// Re-exported so existing `import { BrandMark } from "../Sidebar"` call sites
// keep working; the components themselves live in BrandMark.tsx.
export { BrandMark };

interface NavDef {
  label: string;
  route: Route;
  Icon: typeof Paintbrush;
  adminOnly: boolean;
  /** Route names that keep this item selected. */
  matches: Route["name"][];
}

/** The five nav items of the Sidebar (Figma 56:646), in its order. People
 * and Settings live in Settings, opened from the account gear. A member
 * sees the first two. */
const NAV: NavDef[] = [
  {
    label: "Brand Templates",
    route: { name: "portal" },
    Icon: Paintbrush,
    adminOnly: false,
    matches: ["portal", "template", "templateChat"],
  },
  {
    label: "Generate",
    route: { name: "generate" },
    Icon: Sparkles,
    adminOnly: false,
    matches: ["generate", "generateHistory"],
  },
  {
    label: "Template Builder",
    route: { name: "adminTemplates" },
    Icon: Frame,
    adminOnly: true,
    matches: ["adminTemplates", "builder"],
  },
  {
    label: "Insights & Analytics",
    route: { name: "dashboard" },
    Icon: BarChart3,
    adminOnly: true,
    matches: ["dashboard"],
  },
  {
    label: "Brand Studio",
    route: { name: "brandStudio" },
    Icon: PencilRuler,
    adminOnly: true,
    matches: ["brandStudio"],
  },
];

/** The nav items a role sees. */
export function navFor(role: "admin" | "member"): NavDef[] {
  return NAV.filter((item) => role === "admin" || !item.adminOnly);
}

/** The light and dark quick toggle (Figma 102:574). It writes the same
 * colour scheme Settings' System / Light / Dark control does, so the two
 * always agree. The glyph follows the theme in CSS. */
function SidebarThemeToggle() {
  const { resolved, setScheme } = useColorScheme();
  const next = resolved === "dark" ? "light" : "dark";
  return <ThemeToggle label={`Switch to ${next} mode`} onClick={() => setScheme(next)} />;
}

function useAccount() {
  const { company, role, user } = useAuth();
  const source = user?.email ?? company?.name ?? "?";
  const initials = source
    .split(/[@\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join("");
  const name = user
    ? user.email
        .split("@")[0]
        .replace(/[._-]+/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
    : (company?.name ?? "Workspace");
  // The dev backend has no accounts: the second line says where you are.
  const detail = user?.email ?? `${company?.name ?? "Workspace"} · ${role}`;
  return { initials, name, detail };
}

/** The Account block (Figma 56:1330): avatar, name and email, and the gear
 * that opens Settings, selected while Settings shows. Stacked in the
 * collapsed rail (189:2493). */
function SidebarAccount({
  collapsed,
  onOpenSettings,
}: {
  collapsed: boolean;
  onOpenSettings(): void;
}) {
  const { route } = useRouter();
  const { initials, name, detail } = useAccount();
  const inSettings = route.name === "settings";
  const gear = (
    <IconButton
      variant="ghost"
      icon={Settings}
      label="Settings"
      selected={inSettings}
      aria-current={inSettings ? "page" : undefined}
      onClick={onOpenSettings}
    />
  );
  if (collapsed) {
    return (
      <div className="sp-shell-account" data-collapsed>
        <Avatar initials={initials} size="lg" label={name} />
        {gear}
      </div>
    );
  }
  return (
    <div className="sp-shell-account">
      <Avatar initials={initials} size="lg" />
      <div className="sp-shell-account__text">
        <span className="t-label-s" title={name}>
          {name}
        </span>
        <span className="t-caption-xs sp-shell-account__detail" title={detail}>
          {detail}
        </span>
      </div>
      {gear}
    </div>
  );
}

/** App-shell navigation. Desktop (1024 and wider): the floating Sidebar
 * (Figma 56:646), expanded or collapsed to its 76 rail. Narrower: no rail,
 * a slim top bar with the brand and a menu button, the nav dropping down
 * over a scrim (today's behavior; below desktop the new look changes only
 * its contents). SocialPaint product UI: tenant brand kits never recolour
 * it. */
export function Sidebar() {
  const { role } = useAuth();
  const { route, navigate } = useRouter();
  const [isNarrow, setIsNarrow] = useState(() => window.matchMedia("(max-width: 1023px)").matches);
  const [menuOpen, setMenuOpen] = useState(false);
  // Collapse state lives in ChromeContext: the Template Builder borrows the
  // rail for as long as it owns the viewport, and hands it back untouched.
  const { sidebarCollapsed, setSidebarCollapsed } = useChrome();

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const onChange = () => {
      setIsNarrow(mq.matches);
      setMenuOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Escape closes the mobile menu.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const go = (target: Route) => {
    navigate(target);
    setMenuOpen(false);
  };
  const home: Route = { name: role === "admin" ? "adminTemplates" : "portal" };
  const items = navFor(role);
  const openSettings = () => go({ name: "settings" });

  // ── Narrow: top bar + drop-down navigation ──────────────────────────────
  if (isNarrow) {
    return (
      <>
        {menuOpen && (
          <div
            className="fixed inset-0"
            style={{
              background: "color-mix(in srgb, var(--text-on-accent) 40%, transparent)",
              // One layer under the header so the open menu's scrim covers
              // the page's sticky chrome (the filter bar at --z-sticky) too.
              zIndex: "calc(var(--z-drawer) - 1)",
            }}
            onClick={() => setMenuOpen(false)}
            aria-hidden
          />
        )}
        <header
          className="sp-mobilebar sticky top-0 w-full"
          data-menu-open={menuOpen || undefined}
          style={{
            // App chrome outranks page chrome: above the filter bar's
            // --z-sticky, below modals.
            zIndex: "var(--z-drawer)",
            paddingTop: "env(safe-area-inset-top)",
          }}
        >
          <div className="flex items-center justify-between px-4" style={{ height: 56 }}>
            <button onClick={() => go(home)} aria-label="SocialPaint home">
              <BrandLockup height={18} />
            </button>
            <div className="flex items-center gap-2">
              <SidebarThemeToggle />
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                aria-expanded={menuOpen}
                aria-label={menuOpen ? "Close navigation" : "Open navigation"}
                data-open={menuOpen}
                className="sp-nav-toggle relative flex items-center justify-center "
                data-radius-control
                style={{
                  // 44px touch floor (the .sp-shelf__viewall pattern).
                  width: 44,
                  height: 44,
                  color: "var(--sb-fg-active)",
                  border: "1px solid var(--sb-border)",
                }}
              >
                <span aria-hidden className="sp-nav-toggle__bar sp-nav-toggle__bar--top" />
                <span aria-hidden className="sp-nav-toggle__bar sp-nav-toggle__bar--mid" />
                <span aria-hidden className="sp-nav-toggle__bar sp-nav-toggle__bar--bot" />
              </button>
            </div>
          </div>

          {/* Drop-down panel — slides down from under the bar */}
          <div
            style={{
              display: "grid",
              gridTemplateRows: menuOpen ? "1fr" : "0fr",
              transition: "grid-template-rows var(--dur-panel) var(--ease)",
            }}
          >
            {/* Collapsed to 0fr the nav is clipped, not gone: without
                visibility its buttons stay in the tab order and the AT
                tree. Held visible until the collapse finishes, dropped
                at once on the way open. */}
            <div
              style={{
                overflow: "hidden",
                visibility: menuOpen ? "visible" : "hidden",
                transition: menuOpen ? "visibility 0s" : "visibility 0s linear var(--dur-panel)",
              }}
            >
              <nav
                aria-label="Primary"
                className="px-3 pb-3 pt-1"
                style={{
                  // dvh, not vh: mobile browser chrome shrinks the visual
                  // viewport, and the last nav item must stay reachable. The
                  // header now also carries the safe-area top inset, so that
                  // comes out of the budget too.
                  maxHeight: "calc(100dvh - 72px - env(safe-area-inset-top, 0px))",
                  overflowY: "auto",
                }}
              >
                <div className="sp-shell-nav">
                  {items.map(({ label, route: target, Icon, matches }) => (
                    <NavItem
                      key={label}
                      icon={Icon}
                      selected={matches.includes(route.name)}
                      onClick={() => go(target)}
                    >
                      {label}
                    </NavItem>
                  ))}
                </div>
                <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--sb-border)" }}>
                  <SidebarAccount collapsed={false} onOpenSettings={openSettings} />
                </div>
              </nav>
            </div>
          </div>
        </header>
      </>
    );
  }

  // ── Desktop: the floating Sidebar ───────────────────────────────────────
  const collapsed = sidebarCollapsed;
  const collapseButton = (
    <IconButton
      variant="ghost"
      icon={PanelLeft}
      label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      aria-expanded={!collapsed}
      onClick={() => setSidebarCollapsed(!collapsed)}
    />
  );
  return (
    <div className="sp-shell-sidebar" data-collapsed={collapsed || undefined}>
      <aside className="sp-shell-panel" aria-label="Sidebar">
        {collapsed ? (
          <>
            <div className="sp-shell-panel__header">{collapseButton}</div>
            <button
              className="sp-shell-mark"
              onClick={() => go(home)}
              aria-label="SocialPaint home"
            >
              <BrandMark width={24} />
            </button>
          </>
        ) : (
          <div className="sp-shell-panel__header">
            <button
              className="sp-shell-logo"
              onClick={() => go(home)}
              aria-label="SocialPaint home"
            >
              <BrandLockup height={24} />
            </button>
            <div className="sp-shell-panel__utility">
              <SidebarThemeToggle />
              {collapseButton}
            </div>
          </div>
        )}

        {/* Nav: scrolls on short viewports so the account stays reachable. */}
        <nav className="sp-shell-nav" aria-label="Primary">
          {items.map(({ label, route: target, Icon, matches }) => {
            const item = (
              <NavItem
                key={label}
                icon={Icon}
                selected={matches.includes(route.name)}
                showLabel={!collapsed}
                onClick={() => go(target)}
              >
                {label}
              </NavItem>
            );
            return collapsed ? (
              <Tooltip key={label} content={label} placement="right">
                {item}
              </Tooltip>
            ) : (
              item
            );
          })}
        </nav>

        <SidebarAccount collapsed={collapsed} onOpenSettings={openSettings} />
      </aside>
    </div>
  );
}
