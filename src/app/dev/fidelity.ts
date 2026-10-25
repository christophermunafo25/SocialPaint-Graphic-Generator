// The fidelity fixtures (brand-system PHASE-0): what a fixture file holds,
// and how the dev render page turns a fixture name into the exact inputs
// SchemaRenderer gets. Pure: the page owns loading and the DOM.

import type { BrandAsset, BrandKit, FieldValues, TemplateSchema } from "@/lib/types";
import type { EmptyFieldsMode } from "@/lib/render/emptyFields";
import { STARTER_BLUEPRINTS } from "@/lib/templates/starters";
import { materializeStarter } from "@/lib/templates/starters/materialize";

export type FidelityEngine = "chromium" | "firefox" | "webkit";

/** One font file a fixture renders with. `file` is a root-relative URL
 * ("/test/fidelity/fonts-private/Brand-Bold.woff2"), or a name beside the
 * fixture's own fixture.json. */
export interface FixtureFont {
  family: string;
  file: string;
  weight: number;
  style: "normal" | "italic";
}

/** test/fidelity/fixtures/<name>/fixture.json. A "figma" fixture carries
 * its schema and compares with a golden exported from `source`; a
 * "starter" fixture is materialized here from a blueprint and compares
 * with a blessed Chromium render; a "synthetic" fixture carries a schema
 * built in code and compares with a blessed Chromium render too. */
export interface FidelityFixture {
  name: string;
  kind: "figma" | "starter" | "synthetic";
  /** starter: the blueprint's starterKey, for a fixture named on its own
   * (not starter-<key>). It carries `values` and `variantId` from the file;
   * a starter fixture without it takes its blueprint from its name. */
  starter?: string;
  source?: { fileKey: string; nodeId: string };
  schema?: TemplateSchema;
  values?: FieldValues;
  brandKit?: BrandKit | null;
  fonts?: FixtureFont[];
  variantId?: string | null;
  emptyFields?: EmptyFieldsMode;
  /** Ingredients the schema can't express today, each with its reason. */
  unsupported?: string[];
  /** Changed share in percent per engine, recorded with CJ's approval. */
  baseline?: Partial<Record<FidelityEngine, number>>;
  /** The same after a 4px blur of both images (tone and shadow, without
   * grain speckle), recorded with CJ's approval. */
  blurBaseline?: Partial<Record<FidelityEngine, number>>;
  /** Compare with another fixture's golden.png (the same Figma frame
   * rebuilt a second way). */
  goldenFrom?: string;
  /** Points a run may exceed its baseline by (default 0.25). */
  tolerance?: number;
}

/** What the page hands SchemaRenderer, resolved from a fixture. */
export interface ResolvedFixture {
  schema: TemplateSchema;
  values: FieldValues;
  brandKit: BrandKit | null;
  variantId: string | null;
  emptyFields: EmptyFieldsMode;
  fonts: FixtureFont[];
}

/** The sample workspace the starter fixtures materialize against
 * (scripts/new-look/fixtures/dev-workspace.json). */
export interface StarterWorkspace {
  company: { id: string; name: string; website?: string };
  kit: BrandKit;
}

export const STARTER_PREFIX = "starter-";

/** Fixed stamps keep a starter fixture's schema identical run to run. */
const FIXTURE_STAMP = "2026-10-08T00:00:00.000Z";

/** `starter-<starterKey>` materialized through the same path seeding uses.
 * Null when the key names no blueprint. `variant` "dark" selects the Dark
 * colourway; anything else renders the Light base. */
export function resolveStarterFixture(
  name: string,
  variant: string | undefined,
  workspace: StarterWorkspace,
): ResolvedFixture | null {
  if (!name.startsWith(STARTER_PREFIX)) return null;
  return materializeStarterFixture(name, name.slice(STARTER_PREFIX.length), variant, {}, workspace);
}

/** A starter fixture file that names its blueprint with `starter`: the
 * blueprint materialized as resolveStarterFixture does, with the file's
 * values. `variant` from the address wins over the file's own. Null when
 * the file names no blueprint, or one that doesn't exist. */
export function resolveKeyedStarterFixture(
  fixture: FidelityFixture,
  variant: string | undefined,
  workspace: StarterWorkspace,
): ResolvedFixture | null {
  if (fixture.kind !== "starter" || !fixture.starter) return null;
  return materializeStarterFixture(
    fixture.name,
    fixture.starter,
    variant ?? fixture.variantId ?? undefined,
    fixture.values ?? {},
    workspace,
  );
}

function materializeStarterFixture(
  name: string,
  key: string,
  variant: string | undefined,
  values: FieldValues,
  workspace: StarterWorkspace,
): ResolvedFixture | null {
  const blueprint = STARTER_BLUEPRINTS.find((b) => b.starterKey === key);
  if (!blueprint) return null;
  const input = materializeStarter(blueprint, {
    company: workspace.company,
    kit: workspace.kit,
    seededAt: FIXTURE_STAMP,
  });
  const schema: TemplateSchema = {
    ...input,
    id: name,
    createdAt: FIXTURE_STAMP,
    updatedAt: FIXTURE_STAMP,
  };
  return {
    schema,
    values,
    brandKit: workspace.kit,
    variantId: variant === "dark" ? "dark" : null,
    emptyFields: "placeholder",
    fonts: [],
  };
}

/** A figma fixture's file contents as renderer inputs. Null when the file
 * carries no schema. `variant` from the address wins over the file's own. */
export function resolveFileFixture(
  fixture: FidelityFixture,
  variant: string | undefined,
): ResolvedFixture | null {
  if (!fixture.schema) return null;
  return {
    schema: fixture.schema,
    values: fixture.values ?? {},
    brandKit: fixture.brandKit ?? null,
    variantId: variant ?? fixture.variantId ?? null,
    emptyFields: fixture.emptyFields ?? "placeholder",
    fonts: fixture.fonts ?? [],
  };
}

/** Where a fixture font is served from in dev. */
export function fixtureFontUrl(fixtureName: string, font: FixtureFont): string {
  if (font.file.startsWith("/")) return font.file;
  return `/test/fidelity/fixtures/${fixtureName}/${font.file}`;
}

const FONT_FORMATS = {
  woff2: "woff2",
  woff: "woff",
  ttf: "truetype",
  otf: "opentype",
} as const;

/** A fixture font as the BrandAsset registerCustomFont takes, so fixture
 * faces register and embed at export exactly as an uploaded font does. */
export function fixtureFontAsset(fixtureName: string, font: FixtureFont): BrandAsset {
  const url = fixtureFontUrl(fixtureName, font);
  const ext = url.split(".").pop()?.toLowerCase() ?? "";
  const format = FONT_FORMATS[ext as keyof typeof FONT_FORMATS];
  return {
    id: `fixture-font:${url}:${font.weight}:${font.style}`,
    companyId: "fidelity",
    kind: "font",
    name: url.split("/").pop() ?? font.family,
    url,
    metadata: {
      family: font.family,
      weight: font.weight,
      style: font.style,
      ...(format ? { format } : {}),
    },
    createdAt: FIXTURE_STAMP,
  };
}
