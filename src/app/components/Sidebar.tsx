import React, { useEffect, useState } from "react";
import {
  BarChart3,
  Frame,
  Moon,
  Paintbrush,
  PanelLeft,
  PencilRuler,
  Settings,
  Sparkles,
  Sun,
} from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useColorScheme } from "@/lib/colorScheme";
import { useRouter, type Route } from "../router";
import { useChrome } from "./layout/ChromeContext";
import { BrandLockup } from "./BrandMark";
import { Avatar, IconButton, NavItem, Tooltip } from "./primitives";

interface NavDef {
  label: string;
  route: Route;
  Icon: typeof Paintbrush;
  adminOnly: boolean;
  /** Route names that keep this item selected. */
  matches: Route["name"][];
}

/** The five nav items of the Sidebar (2218:588), in its order. People and
 * Settings live in Settings, opened from the account. A member sees the
 * first two. */
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

/** The sun in Light and the moon in Dark. The icon button shows the one
 * for the nearest theme. */
const THEME_GLYPHS = { light: Sun, dark: Moon };

/** The light and dark quick toggle. It writes the same colour scheme
 * Settings' System / Light / Dark control does, so the two always agree.
 * The file draws no toggle; CJ kept it beside Collapse (2026-11-15), in the
 * Collapse button's look (Ghost Small). The collapsed rail leaves it out. */
function SidebarThemeToggle() {
  const { resolved, setScheme } = useColorScheme();
  const next = resolved === "dark" ? "light" : "dark";
  return (
    <IconButton
      variant="ghost"
      size="sm"
      icon={THEME_GLYPHS}
      label={`Switch to ${next} mode`}
      onClick={() => setScheme(next)}
    />
  );
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

/** The account row (2218:620): the avatar, the name over the email 8 apart,
 * and Settings, 12 apart, selected while Settings shows. The collapsed rail
 * (2218:673) draws the avatar alone, so there the avatar is the Settings
 * button. */
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
  if (collapsed) {
    return (
      <div className="sp-shell-account" data-collapsed>
        <Tooltip label="Settings" placement="right">
          <button
            type="button"
            className="ui-reset ui-ring sp-shell-account__settings"
            aria-label="Settings"
            aria-current={inSettings ? "page" : undefined}
            onClick={onOpenSettings}
          >
            <Avatar initials={initials} />
          </button>
        </Tooltip>
      </div>
    );
  }
  return (
    <div className="sp-shell-account">
      <Avatar initials={initials} />
      <div className="sp-shell-account__text">
        <span className="t-label-m sp-shell-account__name" title={name}>
          {name}
        </span>
        <span className="t-caption-m sp-shell-account__detail" title={detail}>
          {detail}
        </span>
      </div>
      <IconButton
        variant="ghost"
        size="sm"
        icon={Settings}
        label="Settings"
        selected={inSettings}
        aria-current={inSettings ? "page" : undefined}
        onClick={onOpenSettings}
      />
    </div>
  );
}

/** App-shell navigation. At 1024 and wider: the Sidebar (2218:679), open at
 * 320 or collapsed to its 76 rail, the frame's first part. Narrower: no
 * rail, a slim top bar with the lockup, the theme toggle and a menu button,
 * the nav dropping down over a scrim (no frame draws it; it keeps its
 * earlier behavior on the new tokens). SocialPaint product UI: tenant
 * brand kits never recolour it. */
export function Sidebar() {
  const { role } = useAuth();
  const { route, navigate } = useRouter();
  const [isNarrow, setIsNarrow] = useState(() => window.matchMedia("(max-width: 1023px)").matches);
  const [menuOpen, setMenuOpen] = useState(false);
  // Collapse state lives in ChromeContext: the Template Builder borrows the
  // rail for as long as it is open, and hands it back untouched.
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
          <div className="sp-mobilebar__scrim" onClick={() => setMenuOpen(false)} aria-hidden />
        )}
        <header className="sp-mobilebar" data-menu-open={menuOpen || undefined}>
          <div className="sp-mobilebar__row">
            <button
              className="sp-shell-logo"
              onClick={() => go(home)}
              aria-label="SocialPaint home"
            >
              <BrandLockup height={18} />
            </button>
            <div className="sp-mobilebar__end">
              <SidebarThemeToggle />
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                aria-expanded={menuOpen}
                aria-label={menuOpen ? "Close navigation" : "Open navigation"}
                data-open={menuOpen}
                className="sp-nav-toggle sp-mobilebar__toggle"
              >
                <span aria-hidden className="sp-nav-toggle__bar sp-nav-toggle__bar--top" />
                <span aria-hidden className="sp-nav-toggle__bar sp-nav-toggle__bar--mid" />
                <span aria-hidden className="sp-nav-toggle__bar sp-nav-toggle__bar--bot" />
              </button>
            </div>
          </div>

          {/* The drop-down panel, sliding down from under the bar. Collapsed,
              the nav is clipped, not gone: without visibility its buttons
              would stay in the tab order and the accessibility tree. */}
          <div className="sp-mobilebar__drawer" data-open={menuOpen || undefined}>
            <div className="sp-mobilebar__clip">
              <nav aria-label="Primary" className="sp-mobilebar__nav">
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
                <div className="sp-mobilebar__account">
                  <SidebarAccount collapsed={false} onOpenSettings={openSettings} />
                </div>
              </nav>
            </div>
          </div>
        </header>
      </>
    );
  }

  // ── Desktop: the Sidebar ────────────────────────────────────────────────
  const collapsed = sidebarCollapsed;
  const collapseButton = (
    <IconButton
      variant="ghost"
      size={collapsed ? "md" : "sm"}
      icon={PanelLeft}
      label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      aria-expanded={!collapsed}
      onClick={() => setSidebarCollapsed(!collapsed)}
    />
  );
  return (
    <div className="sp-shell-sidebar" data-collapsed={collapsed || undefined}>
      <aside className="sp-shell-panel" aria-label="Sidebar">
        <div className="sp-shell-panel__header">
          {collapsed ? (
            collapseButton
          ) : (
            <>
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
            </>
          )}
        </div>

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
              <Tooltip key={label} label={label} placement="right">
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
