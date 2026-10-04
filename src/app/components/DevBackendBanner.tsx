import { useLayoutEffect, useRef } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { stores } from "@/lib/stores";
import type { Role } from "@/lib/types";
import { SegmentedControl } from "./primitives";

const ROLES = [
  { id: "admin", label: "Admin" },
  { id: "member", label: "Member" },
];

/** Persistent warning whenever the app runs on the localStorage dev backend:
 * everything lives in this browser and dies with a cache clear. Fixed to the
 * viewport on every screen (portal, builder, onboarding) so the dev backend
 * can't be mistaken for a real deployment after ten minutes of use. Warning
 * tone per the DS — signals keep their hue. Sits under sp-toast (z 60).
 *
 * It also carries the dev role switch (new look, Phase 3: it left the
 * sidebar), because the banner shows for both roles on every screen. The
 * warning stays its own live region; the switch sits outside it. The
 * screenshot loop hides the whole banner by data-dev-banner.
 *
 * It publishes its height as --dev-banner-h on <html>, so the sidebar
 * stops above it rather than under it (the account gear would otherwise
 * sit behind the banner on a short viewport). */
export function DevBackendBanner() {
  const { role, setRole } = useAuth();
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const publish = () => root.style.setProperty("--dev-banner-h", `${el.offsetHeight}px`);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--dev-banner-h");
    };
  }, []);
  if (stores.backend !== "local") return null;
  return (
    <div
      ref={ref}
      data-dev-banner
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        background: "var(--fill-warning)",
        color: "var(--ink)",
        textAlign: "center",
        padding: "6px 16px",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--type-caption-size)",
        fontWeight: "var(--weight-ui)",
      }}
    >
      <span role="status">
        Dev backend: data is stored in this browser only and will be lost. Not for production use.
      </span>
      <SegmentedControl
        aria-label="Dev role"
        options={ROLES}
        selectedId={role}
        onSelect={(id) => setRole(id as Role)}
      />
    </div>
  );
}
