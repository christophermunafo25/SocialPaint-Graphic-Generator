import { stores } from "@/lib/stores";

/** Persistent warning whenever the app runs on the localStorage dev backend:
 * everything lives in this browser and dies with a cache clear. Fixed to the
 * viewport on every screen (portal, builder, onboarding) so the dev backend
 * can't be mistaken for a real deployment after ten minutes of use. Warning
 * tone per the DS — signals keep their hue. Sits under sp-toast (z 60). */
export function DevBackendBanner() {
  if (stores.backend !== "local") return null;
  return (
    <div
      role="status"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        background: "var(--fill-warning)",
        color: "var(--ink)",
        textAlign: "center",
        padding: "6px 16px",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--type-caption-size)",
        fontWeight: 600,
      }}
    >
      Dev backend: data is stored in this browser only and will be lost. Not for production use.
    </div>
  );
}
