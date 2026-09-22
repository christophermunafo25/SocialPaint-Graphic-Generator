// Appendix B slot values: the fixed neutrals every tenant's starter
// templates share, and the fallbacks for the tenant-derived slots. This
// module and blueprints.ts are the sanctioned homes for these hexes —
// components never carry them.
//
// Every neutral pairing (ink on surface, inkMuted on surfaceAlt, border on
// either surface) is pre-verified at WCAG AA for its usage; only the
// accent-involved pairs are computed at seed time (materialize.ts).

import type { FontRef } from "../../types";
import type { SlotColor } from "./types";

export type NeutralSlot = Exclude<SlotColor, "accent" | "onAccent">;

export const NEUTRALS_LIGHT: Record<NeutralSlot, string> = {
  surface: "#FFFFFF",
  surfaceAlt: "#F1F0EC",
  ink: "#111112",
  inkMuted: "#6E6E70",
  border: "#DEDDD8",
};

export const NEUTRALS_DARK: Record<NeutralSlot, string> = {
  surface: "#101011",
  surfaceAlt: "#1B1B1D",
  ink: "#F7F6F3",
  inkMuted: "#A2A2A4",
  border: "#2E2E31",
};

/** The accent when the tenant palette offers nothing usable. Pre-verified:
 * 4.1:1 on the light surface and 4.6:1 on the dark one, both over the 3.0
 * floor for the >= 22px text it colors. */
export const ACCENT_FALLBACK = "#E2452C";

/** The two onAccent candidates; whichever clears 4.5 on the accent wins. */
export const ON_ACCENT_DARK = "#111112";
export const ON_ACCENT_LIGHT = "#FFFFFF";

/** Font fallbacks for a kit missing a heading or body pick, and the fixed
 * label face (tenants restyle labels later in the builder). */
export const DISPLAY_FONT_FALLBACK: FontRef = { source: "google", family: "Archivo" };
export const BODY_FONT_FALLBACK: FontRef = { source: "google", family: "Instrument Sans" };
export const LABEL_FONT_FAMILY = "IBM Plex Mono";
