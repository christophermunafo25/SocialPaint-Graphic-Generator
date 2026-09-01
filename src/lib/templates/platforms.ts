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
 *  the bucket for platform-neutral sizes, which the catalogue ships one of
 *  (general-square-1440). Without it, every template built on the default
 *  canvas would be unclassifiable. */
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

/** What a known canvas size means. One size can serve SEVERAL platforms —
 *  1080×1350 is the portrait post on Instagram, Facebook, AND LinkedIn — and
 *  the catalogue shows it that way: the platform list drives the group label
 *  ("Instagram · Facebook · LinkedIn Portrait") and search. Order inside
 *  `platforms` is display order; the first entry is the primary (icons,
 *  stable ids). Dimensions mirror the published size sheet, 2026-08-07. */
export interface SizeMeaning {
  platforms: PlatformId[];
  /** "Portrait post" | "Story · Reel · Vertical video" | … — sentence case. */
  assetType: string;
}

/** One entry of the canonical size catalogue: a known canvas size, its
 *  meaning, and a stable id derived from the primary platform and the
 *  dimensions. The id is what `company_canvas_presets` rows and the size
 *  picker reference — it must never change once shipped. */
export interface CanvasSize extends SizeMeaning {
  id: string;
  width: number;
  height: number;
}

/** THE size catalogue — the single source of dimension data for the whole
 *  product. The picker, the Settings enable list, classification, and search
 *  all read from here; nothing else stores a width or height per size. */
export const SIZE_CATALOG: CanvasSize[] = [
  // First on purpose: the first enabled entry is the default for a blank
  // template, and the platform-neutral square has been that default since v1.
  {
    id: "general-square-1440",
    width: 1440,
    height: 1440,
    platforms: ["general"],
    assetType: "Square canvas",
  },
  {
    id: "ig-portrait-1080x1350",
    width: 1080,
    height: 1350,
    platforms: ["instagram", "facebook", "linkedin"],
    assetType: "Portrait post",
  },
  {
    id: "ig-square-1080x1080",
    width: 1080,
    height: 1080,
    platforms: ["instagram", "facebook"],
    assetType: "Square post",
  },
  {
    id: "ig-landscape-1080x566",
    width: 1080,
    height: 566,
    platforms: ["instagram"],
    assetType: "Landscape post",
  },
  {
    id: "ig-story-1080x1920",
    width: 1080,
    height: 1920,
    platforms: ["instagram", "facebook", "linkedin", "tiktok"],
    assetType: "Story · Reel · Vertical video",
  },
  {
    id: "fb-link-1200x630",
    width: 1200,
    height: 630,
    platforms: ["facebook", "web"],
    assetType: "Link preview · Open Graph",
  },
  {
    id: "li-square-1200x1200",
    width: 1200,
    height: 1200,
    platforms: ["linkedin"],
    assetType: "Square post",
  },
  {
    id: "li-landscape-1200x627",
    width: 1200,
    height: 627,
    platforms: ["linkedin"],
    assetType: "Landscape post · Link preview",
  },
  {
    id: "x-landscape-1600x900",
    width: 1600,
    height: 900,
    platforms: ["x"],
    assetType: "Landscape post",
  },
  {
    id: "yt-thumbnail-1280x720",
    width: 1280,
    height: 720,
    platforms: ["youtube"],
    assetType: "Thumbnail",
  },
  {
    id: "pinterest-pin-1000x1500",
    width: 1000,
    height: 1500,
    platforms: ["pinterest"],
    assetType: "Pin",
  },
  {
    id: "email-header-600x200",
    width: 600,
    height: 200,
    platforms: ["email"],
    assetType: "Email header",
  },
  {
    id: "display-medium-rectangle-300x250",
    width: 300,
    height: 250,
    platforms: ["display"],
    assetType: "Medium rectangle",
  },
  {
    id: "display-leaderboard-728x90",
    width: 728,
    height: 90,
    platforms: ["display"],
    assetType: "Leaderboard",
  },
  {
    id: "display-half-page-300x600",
    width: 300,
    height: 600,
    platforms: ["display"],
    assetType: "Half page",
  },
];

const SIZE_BY_ID = new Map(SIZE_CATALOG.map((s) => [s.id, s]));

export const sizeById = (id: string): CanvasSize | undefined => SIZE_BY_ID.get(id);

/** Exact dimension match only. A near-miss is a different size, not a typo —
 *  guessing would put templates on shelves they don't belong to. */
export function classifySize(width: number, height: number): SizeMeaning {
  const hit = SIZE_CATALOG.find((s) => s.width === width && s.height === height);
  if (hit) return { platforms: hit.platforms, assetType: hit.assetType };
  // An unseeded size is honestly unclassifiable; it still belongs somewhere
  // the member can find it.
  return { platforms: ["general"], assetType: "Custom size" };
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
