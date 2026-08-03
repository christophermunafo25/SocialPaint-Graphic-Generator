import {
  AtSign,
  Facebook,
  Globe,
  Instagram,
  LayoutTemplate,
  Linkedin,
  Mail,
  Megaphone,
  Music2,
  Pin,
  Printer,
  X as XIcon,
  Youtube,
} from "lucide-react";
import type { CanvasPreset } from "@/lib/types";

/** Every platform the catalogue can group by. The order here IS the shelf
 *  order on the Brand templates page — deliberate, never by template count. */
export type PlatformId =
  | "linkedin"
  | "instagram"
  | "facebook"
  | "x"
  | "tiktok"
  | "youtube"
  | "pinterest"
  | "threads"
  | "email"
  | "display"
  | "web"
  | "print"
  | "general";

export interface Platform {
  id: PlatformId;
  /** Real casing — proper nouns keep it, per the DS content rules. */
  label: string;
  Icon: typeof Linkedin;
}

/** Fixed display order. `general` sits last: it is not a social platform but
 *  the bucket for platform-neutral sizes, which the repo ships one of
 *  (square-1440). Without it, every template built on the default canvas
 *  would be unclassifiable. */
export const PLATFORMS: Platform[] = [
  { id: "linkedin", label: "LinkedIn", Icon: Linkedin },
  { id: "instagram", label: "Instagram", Icon: Instagram },
  { id: "facebook", label: "Facebook", Icon: Facebook },
  { id: "x", label: "X", Icon: XIcon },
  { id: "tiktok", label: "TikTok", Icon: Music2 },
  { id: "youtube", label: "YouTube", Icon: Youtube },
  { id: "pinterest", label: "Pinterest", Icon: Pin },
  { id: "threads", label: "Threads", Icon: AtSign },
  { id: "email", label: "Email", Icon: Mail },
  { id: "display", label: "Display ads", Icon: Megaphone },
  { id: "web", label: "Web & Open Graph", Icon: Globe },
  { id: "print", label: "Print", Icon: Printer },
  { id: "general", label: "General", Icon: LayoutTemplate },
];

const BY_ID = new Map(PLATFORMS.map((p) => [p.id, p]));

export const platformById = (id: PlatformId): Platform => BY_ID.get(id)!;

/** What a known canvas size means. Keyed by the `canvas_presets` row id, so
 *  this table and `supabase/seed.sql` stay in lockstep — adding a preset row
 *  means adding one line here, and nothing else.
 *
 *  These are the ONLY sizes the catalogue knows about, because they are the
 *  only ones the repo actually declares. Dimensions are not invented here;
 *  every entry mirrors a seeded row. */
interface SizeMeaning {
  platform: PlatformId;
  /** "Feed post" | "Story" | "Banner" | … — sentence case, DS content rules. */
  assetType: string;
}

const SIZE_MEANING: Record<string, SizeMeaning> = {
  "square-1440": { platform: "general", assetType: "Square canvas" },
  "ig-post-1080": { platform: "instagram", assetType: "Feed post" },
  "ig-story-1080": { platform: "instagram", assetType: "Story" },
  "fb-post-1200": { platform: "facebook", assetType: "Feed post" },
  "li-post-1200": { platform: "linkedin", assetType: "Feed post" },
};

/** Every seeded size, whether or not it is currently offered to admins.
 *  `listCanvasPresets()` filters to `enabled`, which is the right rule for
 *  the builder's size picker but the wrong one here: a template built at a
 *  size that was later disabled still belongs to its platform. */
export const KNOWN_SIZES: Array<CanvasPreset & SizeMeaning> = [
  { id: "square-1440", label: "Square (1440×1440)", width: 1440, height: 1440, enabled: true, ...SIZE_MEANING["square-1440"] },
  { id: "ig-post-1080", label: "Instagram Post (1080×1080)", width: 1080, height: 1080, enabled: false, ...SIZE_MEANING["ig-post-1080"] },
  { id: "ig-story-1080", label: "Instagram Story (1080×1920)", width: 1080, height: 1920, enabled: false, ...SIZE_MEANING["ig-story-1080"] },
  { id: "fb-post-1200", label: "Facebook (1200×630)", width: 1200, height: 630, enabled: false, ...SIZE_MEANING["fb-post-1200"] },
  { id: "li-post-1200", label: "LinkedIn (1200×627)", width: 1200, height: 627, enabled: false, ...SIZE_MEANING["li-post-1200"] },
];

/** Exact dimension match only. A near-miss is a different size, not a typo —
 *  guessing would put templates on shelves they don't belong to. */
export function classifySize(width: number, height: number): SizeMeaning {
  const hit = KNOWN_SIZES.find((s) => s.width === width && s.height === height);
  if (hit) return { platform: hit.platform, assetType: hit.assetType };
  // An unseeded size is honestly unclassifiable; it still belongs somewhere
  // the member can find it.
  return { platform: "general", assetType: "Custom size" };
}

export type Orientation = "square" | "portrait" | "vertical" | "landscape";

/** `vertical` is the story/reel band (9:16 and taller); `portrait` is the
 *  gentler 4:5 band. Splitting them lets a member search either word and get
 *  what they pictured. */
export function orientationOf(width: number, height: number): Orientation {
  const r = width / height;
  if (Math.abs(r - 1) < 0.01) return "square";
  if (r > 1) return "landscape";
  return r <= 0.6 ? "vertical" : "portrait";
}

/** Ratios worth naming. Anything outside the tolerance falls back to the
 *  reduced fraction rather than being forced into a familiar-looking lie. */
const NAMED_RATIOS: Array<{ label: string; value: number }> = [
  { label: "1:1", value: 1 },
  { label: "4:5", value: 4 / 5 },
  { label: "5:4", value: 5 / 4 },
  { label: "2:3", value: 2 / 3 },
  { label: "3:2", value: 3 / 2 },
  { label: "3:4", value: 3 / 4 },
  { label: "4:3", value: 4 / 3 },
  { label: "9:16", value: 9 / 16 },
  { label: "16:9", value: 16 / 9 },
  { label: "1.91:1", value: 1.91 },
];

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

export function aspectRatioOf(width: number, height: number): string {
  const r = width / height;
  const named = NAMED_RATIOS.find((n) => Math.abs(r - n.value) / n.value < 0.02);
  if (named) return named.label;
  const d = gcd(width, height) || 1;
  return `${width / d}:${height / d}`;
}
