import React, { useEffect, useState } from "react";
import {
  BarChart3,
  Frame,
  LogOut,
  Moon,
  Paintbrush,
  PanelLeft,
  PencilRuler,
  Settings,
  Sun,
  Users,
} from "lucide-react";
import { stores } from "@/lib/stores";
import { useAsync } from "@/lib/useAsync";
import { useAuth } from "@/lib/auth/AuthContext";
import { useColorScheme } from "@/lib/colorScheme";
import { useRouter, type Route } from "../router";
import logoOnLight from "@/assets/socialpaint/logo-on-light.svg";
import logoOnDark from "@/assets/socialpaint/logo-on-dark.svg";

const LS_COLLAPSED = "sp-sidebar-collapsed";

/** The SocialPaint mark — the Voltage swoosh, the same artwork that carries
 * the mark in the horizontal lockups. Painted with currentColor so it can
 * sit in Volt on the collapsed rail and as a tinted watermark elsewhere;
 * the brand default is Volt in both themes. Used where the full lockup
 * doesn't fit. */
export function BrandMark({ width = 28 }: { width?: number }) {
  return (
    <svg viewBox="0 0 78 75" fill="currentColor" style={{ width, height: "auto", display: "block" }} aria-hidden>
      <path d="M71.015 20.1137C78.0595 17.0276 80.2378 8.13069 75.4088 2.16802C73.6321 -0.0258537 70.5303 -0.637869 68.0462 0.715313L55.4811 7.56023C55.4811 7.56023 41.6669 14.0438 39.5209 14.9553L39.2042 15.0805L38.7605 15.2386C38.7605 15.2386 21.1752 22.8273 14.4914 25.9586C9.49613 28.302 -2.18124 33.7813 0.356282 43.6079C2.94579 53.544 16.2801 52.8276 21.3504 52.5552L21.3702 52.5541C28.8126 52.1492 38.0973 50.6715 46.2913 49.3674L46.339 49.3598C48.2472 49.0573 50.3401 48.7224 52.4318 48.4062C48.6605 51.7677 44.7414 54.9584 40.6863 57.9693C36.0655 61.4002 34.672 67.7996 37.7963 72.6205C39.3773 75.0599 42.6596 75.7537 45.0519 74.092C50.9981 69.9619 56.7088 65.5035 62.157 60.7373C75.0652 49.3423 76.569 44.0012 76.2808 39.9286C76.1987 38.7219 75.8619 37.5459 75.2925 36.4774C74.7231 35.4089 73.9338 34.4719 72.9761 33.7274C68.5158 30.2063 62.0155 31.0281 43.8614 33.9151L43.8136 33.9227C40.5056 34.4509 36.1941 35.1394 31.8322 35.7378C36.0674 34.1303 40.391 32.5915 43.9414 31.3279L44.3977 31.1655L44.5625 31.1069C50.562 28.5897 68.1728 21.3588 68.1728 21.3588L71.015 20.1137Z" />
    </svg>
  );
}

/** The official horizontal lockup — dark-green artwork on light chrome,
 * lime + white artwork on dark. */
function BrandLockup({ height = 16 }: { height?: number }) {
  const { resolved } = useColorScheme();
  return (
    <img
      src={resolved === "dark" ? logoOnDark : logoOnLight}
      alt="SocialPaint"
      style={{ height, width: "auto", display: "block" }}
    />
  );
}

interface NavItem {
  label: string;
  route: Route;
  Icon: typeof Paintbrush;
  adminOnly: boolean;
  /** Route names that keep this item highlighted. */
  matches: string[];
}

/** Figma order: Brand templates · Templates · Insights & Analytics ·
 * Brand Studio · People · Settings & Admin. Members see only the first. */
const NAV: NavItem[] = [
  { label: "Brand templates", route: { name: "portal" }, Icon: Paintbrush, adminOnly: false, matches: ["portal", "template"] },
  { label: "Template Builder", route: { name: "adminTemplates" }, Icon: Frame, adminOnly: true, matches: ["adminTemplates", "builder"] },
  { label: "Insights & Analytics", route: { name: "dashboard" }, Icon: BarChart3, adminOnly: true, matches: ["dashboard"] },
  { label: "Brand Studio", route: { name: "brandStudio" }, Icon: PencilRuler, adminOnly: true, matches: ["brandStudio"] },
  { label: "People", route: { name: "people" }, Icon: Users, adminOnly: true, matches: ["people"] },
  { label: "Settings & Admin", route: { name: "settings" }, Icon: Settings, adminOnly: true, matches: ["settings"] },
];

/** Two-state light/dark quick toggle for the sidebar header. Reads and
 * writes the same ColorScheme state as Settings' System/Light/Dark control —
 * the two always agree; Settings remains the full three-way control. */
function QuickThemeToggle() {
  const { resolved, setScheme } = useColorScheme();
  const next = resolved === "dark" ? "light" : "dark";
  return (
    <button
      onClick={() => setScheme(next)}
      title={`Switch to ${next} mode`}
      aria-label={`Switch to ${next} mode`}
      className="sp-icon-btn"
    >
      {resolved === "dark" ? (
        <Moon style={{ width: 15, height: 15 }} />
      ) : (
        <Sun style={{ width: 15, height: 15 }} />
      )}
    </button>
  );
}

/** Workspace switcher + dev role toggle + user row — shared between the
 * desktop sidebar's bottom block and the mobile dropdown. */
function AccountBlock({ onNavigate }: { onNavigate(route: Route): void }) {
  const { company, companies, role, user, isDevAuth, setCompany, setRole, signOut, backend } = useAuth();
  const initials = (user?.email ?? company?.name ?? "?")
    .split(/[@\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join("");
  const displayName = user
    ? user.email.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : company?.name ?? "Workspace";

  return (
    <>
      {(companies.length > 1 || isDevAuth) && (
        <select
          value={company?.id ?? ""}
          onChange={(e) => {
            if (e.target.value === "__new__") onNavigate({ name: "onboarding" });
            else void setCompany(e.target.value);
          }}
          className="sp-input mb-2"
          style={{ fontSize: "var(--type-caption-size)", padding: "6px 10px" }}
          aria-label="Workspace"
        >
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
          <option value="__new__">+ Create company…</option>
        </select>
      )}
      {isDevAuth && (
        <div className="flex items-center gap-1 mb-3" role="group" aria-label="Dev role (localStorage backend)">
          {(["admin", "member"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className="flex-1 py-1 rounded-md capitalize"
              style={{
                fontSize: 11,
                border: "1px solid var(--sb-border)",
                background: role === r ? "var(--sb-active-bg)" : "transparent",
                color: role === r ? "var(--sb-fg-active)" : "var(--sb-fg)",
              }}
            >
              {r}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center gap-3">
        <span
          className="flex items-center justify-center flex-shrink-0"
          title={`${displayName}${company ? ` · ${company.name}` : ""} · ${role}${backend === "local" ? " · dev backend" : ""}`}
          style={{
            width: 38,
            height: 38,
            borderRadius: "var(--radius-pill)",
            background: "var(--volt)", // flat fill — gradients are banned as surface treatment
            color: "var(--text-on-accent)",
            fontSize: "var(--type-caption-size)",
            fontWeight: "var(--weight-ui)",
          }}
        >
          {initials}
        </span>
        <span className="min-w-0 flex-1 text-left">
          <span
            className="block truncate"
            title={displayName}
            style={{ fontSize: "var(--type-label-size)", fontWeight: 500, color: "var(--sb-fg-active)" }}
          >
            {displayName}
          </span>
          <span
            className="block truncate"
            title={user?.email ?? `${company?.name ?? "Workspace"} · ${role}`}
            style={{ fontSize: 11, color: "var(--sb-fg)" }}
          >
            {user?.email ?? `${company?.name ?? "Workspace"} · ${role}`}
          </span>
        </span>
        {signOut && (
          <button
            onClick={() => void signOut()}
            title="Sign out"
            aria-label="Sign out"
            className="flex items-center justify-center rounded-lg flex-shrink-0"
            style={{ width: 28, height: 28, color: "var(--sb-fg)" }}
          >
            <LogOut style={{ width: 14, height: 14 }} />
          </button>
        )}
      </div>
    </>
  );
}

/** App-shell navigation. Desktop (≥1024px): the persistent left sidebar
 * (Figma node 13:28) with a collapsible icon rail. Mobile: no rail at all —
 * a slim top bar with the brand and a menu button; the nav drops down
 * vertically from the top as a panel over a scrim. SocialPaint product UI —
 * tenant brand kits never re-color it. */
export function Sidebar() {
  const { role, company, backend } = useAuth();
  const { route, navigate } = useRouter();

  // Right-aligned nav counts — only where a REAL count exists: Templates
  // (admin), People (Supabase backend only; the dev backend has no real
  // accounts, and a fabricated 0 would be noise). Refreshes on navigation.
  const countsState = useAsync<Record<string, number>>(async () => {
    if (!company || role !== "admin") return {};
    const out: Record<string, number> = {};
    await Promise.all([
      stores.templates
        .listAll(company.id)
        .then((l) => {
          out.Templates = l.length;
        })
        .catch(() => undefined),
      backend === "supabase"
        ? stores.people
            .list(company.id)
            .then((l) => {
              out.People = l.length;
            })
            .catch(() => undefined)
        : Promise.resolve(),
    ]);
    return out;
  }, [company, role, backend, route.name]);
  const countFor = (label: string): number | null =>
    countsState.status === "ready" ? countsState.data[label] ?? null : null;
  const [isNarrow, setIsNarrow] = useState(() => window.matchMedia("(max-width: 1023px)").matches);
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsedPref, setCollapsedPref] = useState<boolean>(() => {
    try {
      return localStorage.getItem(LS_COLLAPSED) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const onChange = () => {
      setIsNarrow(mq.matches);
      setMenuOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LS_COLLAPSED, collapsedPref ? "1" : "0");
    } catch {
      // persistence is best-effort
    }
  }, [collapsedPref]);

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

  const items = NAV.filter((item) => role === "admin" || !item.adminOnly);

  // ── Mobile: top bar + drop-down navigation ──────────────────────────────
  if (isNarrow) {
    return (
      <>
        {menuOpen && (
          <div
            className="fixed inset-0"
            style={{ background: "color-mix(in srgb, var(--text-on-accent) 40%, transparent)", zIndex: 39 }}
            onClick={() => setMenuOpen(false)}
            aria-hidden
          />
        )}
        <header
          className="sticky top-0 w-full"
          style={{ background: "var(--sb-bg)", borderBottom: "1px solid var(--sb-border)", zIndex: 40 }}
        >
          <div className="flex items-center justify-between px-4" style={{ height: 56 }}>
            <button onClick={() => go({ name: role === "admin" ? "adminTemplates" : "portal" })} aria-label="SocialPaint — home">
              <BrandLockup height={18} />
            </button>
            <div className="flex items-center gap-2">
              <QuickThemeToggle />
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                aria-expanded={menuOpen}
                aria-label={menuOpen ? "Close navigation" : "Open navigation"}
                data-open={menuOpen}
                className="sp-nav-toggle relative flex items-center justify-center rounded-md"
                style={{ width: 36, height: 36, color: "var(--sb-fg-active)", border: "1px solid var(--sb-border)" }}
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
            <div style={{ overflow: "hidden" }}>
              <nav
                aria-label="Primary"
                className="px-3 pb-3 pt-1"
                style={{ maxHeight: "calc(100vh - 72px)", overflowY: "auto" }}
              >
                <div className="flex flex-col gap-1.5">
                  {items.map(({ label, route: target, Icon, matches }) => {
                    const active = matches.includes(route.name);
                    return (
                      <button
                        key={label}
                        onClick={() => go(target)}
                        className="sp-sidebar-item"
                        data-active={active}
                        aria-current={active ? "page" : undefined}
                      >
                        <Icon style={{ width: 17, height: 17, flexShrink: 0 }} />
                        {label}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--sb-border)" }}>
                  <AccountBlock onNavigate={go} />
                </div>
              </nav>
            </div>
          </div>
        </header>
      </>
    );
  }

  // ── Desktop: persistent left sidebar ────────────────────────────────────
  const collapsed = collapsedPref;
  return (
    <div
      className="flex-shrink-0"
      style={{
        // Floating panel: inset 12px from the top, left, and bottom.
        width: `calc(${collapsed ? "var(--sb-width-collapsed)" : "var(--sb-width)"} + 12px)`,
        padding: "12px 0 12px 12px",
        transition: "width 0.2s ease",
      }}
    >
      <aside
        className="sp-sidebar flex flex-col sticky"
        style={{
          top: 12,
          width: collapsed ? "var(--sb-width-collapsed)" : "var(--sb-width)",
          height: "calc(100vh - 24px)",
          padding: collapsed ? "20px 12px" : "20px 16px",
          transition: "width 0.2s ease",
          zIndex: 30,
        }}
      >
        {/* Header row: logo + utility icon buttons (theme quick toggle,
            collapse), vertically centered with the logo. */}
        <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between"} mb-6`}>
          {!collapsed && (
            <button onClick={() => go({ name: role === "admin" ? "adminTemplates" : "portal" })} title="Home" aria-label="SocialPaint — home">
              <BrandLockup />
            </button>
          )}
          <div className="flex items-center gap-2">
            {!collapsed && <QuickThemeToggle />}
            <button
              onClick={() => setCollapsedPref((c) => !c)}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="sp-icon-btn"
            >
              <PanelLeft style={{ width: 15, height: 15 }} />
            </button>
          </div>
        </div>
        {collapsed && (
          <button
            onClick={() => go({ name: role === "admin" ? "adminTemplates" : "portal" })}
            title="SocialPaint — home"
            className="mx-auto mb-6"
            style={{ color: "var(--volt)" }}
          >
            <BrandMark width={26} />
          </button>
        )}

        {/* Nav — scrolls on short viewports so the user block stays reachable. */}
        <nav className="flex flex-col flex-1 min-h-0 overflow-y-auto" style={{ gap: 2 }} aria-label="Primary">
          {items.map(({ label, route: target, Icon, matches }) => {
            const active = matches.includes(route.name);
            const count = countFor(label);
            return (
              <button
                key={label}
                onClick={() => go(target)}
                className="sp-sidebar-item"
                data-active={active}
                title={collapsed ? label : undefined}
                aria-current={active ? "page" : undefined}
                style={collapsed ? { justifyContent: "center", padding: 0 } : undefined}
              >
                <Icon style={{ width: 18, height: 18, flexShrink: 0 }} />
                {!collapsed && label}
                {!collapsed && count !== null && (
                  <span
                    className="ml-auto"
                    style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div style={{ height: 16 }} />

        {!collapsed ? (
          <AccountBlock onNavigate={go} />
        ) : (
          <div className="flex justify-center">
            <span
              className="flex items-center justify-center"
              style={{
                width: 34,
                height: 34,
                borderRadius: "var(--radius-pill)",
                background: "var(--volt)",
                color: "var(--text-on-accent)",
                fontSize: 11,
                fontWeight: "var(--weight-ui)",
              }}
            >
              <CollapsedInitials />
            </span>
          </div>
        )}
      </aside>
    </div>
  );
}

function CollapsedInitials() {
  const { company, user } = useAuth();
  return (
    <>
      {(user?.email ?? company?.name ?? "?")
        .split(/[@\s._-]+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((s) => s[0]!.toUpperCase())
        .join("")}
    </>
  );
}
