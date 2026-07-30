import React, { useEffect, useState } from "react";
import {
  BarChart3,
  Frame,
  LogOut,
  Monitor,
  Moon,
  Paintbrush,
  PanelLeft,
  PencilRuler,
  Settings,
  Sun,
  Users,
} from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useColorScheme, type ColorScheme } from "@/lib/colorScheme";
import { useRouter, type Route } from "../router";
import logoOnLight from "@/assets/socialpaint/socialpaint-logo-on-light.svg";
import logoOnDark from "@/assets/socialpaint/socialpaint-logo-on-dark.svg";

const LS_COLLAPSED = "sp-sidebar-collapsed";

/** The SocialPaint mark — five bars and the sparkle square, from the
 * official horizontal logo. One-color via currentColor (the sparkle knocks
 * out to the background). Used where the full lockup doesn't fit: the
 * collapsed rail and DS empty states. */
export function BrandMark({ width = 28 }: { width?: number }) {
  return (
    <svg viewBox="0 0 161 87" fill="currentColor" style={{ width, height: "auto", display: "block" }} aria-hidden>
      <path d="M6.4355 86.5649H0V0H6.4355V86.5649Z" />
      <path d="M23.5976 86.5649H15.0176V0H23.5976V86.5649Z" />
      <path d="M40.7597 86.5649H32.1797V0H40.7597V86.5649Z" />
      <path d="M57.9217 86.5649H47.1952V0H57.9217V86.5649Z" />
      <path d="M75.0838 86.5649H62.2128V0H75.0838V86.5649Z" />
      <path d="M149.104 0C155.343 0 160.4 5.05729 160.4 11.2958V86.5649H119.662C119.662 86.5649 121.912 64.2741 130.667 54.972C139.422 45.6706 160.4 43.2813 160.4 43.2813C160.343 43.2748 139.41 40.8815 130.667 31.5929C121.92 22.2997 119.667 0.0428244 119.662 0C119.653 0.090865 117.397 22.3098 108.66 31.5929C99.9181 40.88 78.9913 43.274 78.927 43.2813C78.927 43.2813 99.9047 45.6705 108.66 54.972C117.404 64.2625 119.657 86.5091 119.662 86.5649H78.3049V0H149.104Z" />
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
  { label: "Templates", route: { name: "adminTemplates" }, Icon: Frame, adminOnly: true, matches: ["adminTemplates", "builder"] },
  { label: "Insights & Analytics", route: { name: "dashboard" }, Icon: BarChart3, adminOnly: true, matches: ["dashboard"] },
  { label: "Brand Studio", route: { name: "brandStudio" }, Icon: PencilRuler, adminOnly: true, matches: ["brandStudio"] },
  { label: "People", route: { name: "people" }, Icon: Users, adminOnly: true, matches: ["people"] },
  { label: "Settings & Admin", route: { name: "settings" }, Icon: Settings, adminOnly: true, matches: ["settings"] },
];

const SCHEME_CYCLE: Array<{ key: ColorScheme; label: string; Icon: typeof Sun }> = [
  { key: "system", label: "System theme", Icon: Monitor },
  { key: "light", label: "Light theme", Icon: Sun },
  { key: "dark", label: "Dark theme", Icon: Moon },
];

function ThemeToggle() {
  const { scheme, setScheme } = useColorScheme();
  const idx = SCHEME_CYCLE.findIndex((s) => s.key === scheme);
  const current = SCHEME_CYCLE[idx === -1 ? 0 : idx];
  const next = SCHEME_CYCLE[(idx + 1) % SCHEME_CYCLE.length];
  return (
    <button
      onClick={() => setScheme(next.key)}
      title={`${current.label} — click for ${next.label.toLowerCase()}`}
      aria-label={`Color theme: ${current.label}. Switch to ${next.label}`}
      className="flex items-center justify-center rounded-lg flex-shrink-0"
      style={{ width: 28, height: 28, color: "var(--sb-fg)" }}
    >
      <current.Icon style={{ width: 14, height: 14 }} />
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
          style={{ fontSize: 12, padding: "6px 10px" }}
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
            borderRadius: 999,
            background: "var(--mint)", // flat fill — gradients are banned as surface treatment
            color: "#122407",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {initials}
        </span>
        <span className="min-w-0 flex-1 text-left">
          <span className="block truncate" style={{ fontSize: 13, fontWeight: 500, color: "var(--sb-fg-active)" }}>
            {displayName}
          </span>
          <span className="block truncate" style={{ fontSize: 11, color: "var(--sb-fg)" }}>
            {user?.email ?? `${company?.name ?? "Workspace"} · ${role}`}
          </span>
        </span>
        <ThemeToggle />
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
  const { role } = useAuth();
  const { route, navigate } = useRouter();
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
            style={{ background: "rgba(18,36,7,0.4)", zIndex: 39 }}
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
        width: collapsed ? "var(--sb-width-collapsed)" : "var(--sb-width)",
        transition: "width 0.2s ease",
      }}
    >
      <aside
        className="sp-sidebar flex flex-col sticky top-0"
        style={{
          width: collapsed ? "var(--sb-width-collapsed)" : "var(--sb-width)",
          height: "100vh",
          padding: collapsed ? "20px 12px" : "24px 20px",
          transition: "width 0.2s ease",
          zIndex: 30,
        }}
      >
        {/* Logo + collapse toggle */}
        <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between"} mb-7`}>
          {!collapsed && (
            <button onClick={() => go({ name: role === "admin" ? "adminTemplates" : "portal" })} title="Home" aria-label="SocialPaint — home">
              <BrandLockup />
            </button>
          )}
          <button
            onClick={() => setCollapsedPref((c) => !c)}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex items-center justify-center rounded-md flex-shrink-0"
            style={{ width: 26, height: 26, color: "var(--sb-fg)", border: "1.5px solid var(--sb-border)" }}
          >
            <PanelLeft style={{ width: 13, height: 13 }} />
          </button>
        </div>
        {collapsed && (
          <button
            onClick={() => go({ name: role === "admin" ? "adminTemplates" : "portal" })}
            title="SocialPaint — home"
            className="mx-auto mb-6"
            style={{ color: "var(--solar)" }}
          >
            <BrandMark width={26} />
          </button>
        )}

        {/* Nav — scrolls on short viewports so the user block stays reachable */}
        <nav className="flex flex-col gap-3.5 flex-1 min-h-0 overflow-y-auto" aria-label="Primary">
          {items.map(({ label, route: target, Icon, matches }) => {
            const active = matches.includes(route.name);
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
                <Icon style={{ width: 17, height: 17, flexShrink: 0 }} />
                {!collapsed && label}
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
                borderRadius: 999,
                background: "var(--mint)",
                color: "#122407",
                fontSize: 11,
                fontWeight: 600,
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
