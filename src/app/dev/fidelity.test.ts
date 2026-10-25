import { describe, expect, it } from "vitest";
import workspaceFile from "../../../scripts/new-look/fixtures/dev-workspace.json";
import type { BrandKit, TemplateSchema } from "@/lib/types";
import { STARTER_BLUEPRINTS } from "@/lib/templates/starters";
import { materializeStarter } from "@/lib/templates/starters/materialize";
import {
  fixtureFontAsset,
  fixtureFontUrl,
  resolveFileFixture,
  resolveKeyedStarterFixture,
  resolveStarterFixture,
  type FidelityFixture,
  type FixtureFont,
  type StarterWorkspace,
} from "./fidelity";

const db = workspaceFile.localStorage["brand-portal-dev-db"];
const workspace: StarterWorkspace = {
  company: { id: db.companies[0].id, name: db.companies[0].name },
  kit: db.brandKits[0] as unknown as BrandKit,
};

describe("starter fixtures", () => {
  it("resolves every blueprint through the seeding materializer", () => {
    for (const blueprint of STARTER_BLUEPRINTS) {
      const name = `starter-${blueprint.starterKey}`;
      const resolved = resolveStarterFixture(name, undefined, workspace);
      expect(resolved).not.toBeNull();
      const seeded = materializeStarter(blueprint, {
        company: workspace.company,
        kit: workspace.kit,
        seededAt: resolved!.schema.autobuildMeta!.seededAt,
      });
      const { id, createdAt, updatedAt, ...rest } = resolved!.schema;
      expect(rest).toEqual(seeded);
      expect(id).toBe(name);
      expect(createdAt).toBe(updatedAt);
      expect(resolved!.brandKit).toBe(workspace.kit);
      expect(resolved!.variantId).toBeNull();
    }
  });

  it("selects the Dark colourway only for variant=dark", () => {
    const dark = resolveStarterFixture("starter-launch-01", "dark", workspace)!;
    expect(dark.variantId).toBe("dark");
    expect(dark.schema.variants?.some((v) => v.id === "dark")).toBe(true);
    expect(resolveStarterFixture("starter-launch-01", "sepia", workspace)!.variantId).toBeNull();
  });

  it("is identical run to run, so a blessed golden stays valid", () => {
    expect(resolveStarterFixture("starter-stat-05", undefined, workspace)).toEqual(
      resolveStarterFixture("starter-stat-05", undefined, workspace),
    );
  });

  it("names no fixture for an unknown key or a non-starter name", () => {
    expect(resolveStarterFixture("starter-nope", undefined, workspace)).toBeNull();
    expect(resolveStarterFixture("gtm-composer", undefined, workspace)).toBeNull();
  });

  it("resolves a keyed starter with its own values and colourway", () => {
    const fixture: FidelityFixture = {
      name: "line-breaks-launch-dark",
      kind: "starter",
      starter: "launch-01",
      variantId: "dark",
      values: { headline: "A headline a member typed" },
    };
    const keyed = resolveKeyedStarterFixture(fixture, undefined, workspace)!;
    const plain = resolveStarterFixture("starter-launch-01", "dark", workspace)!;
    expect(keyed.values).toEqual(fixture.values);
    expect(keyed.variantId).toBe("dark");
    expect(keyed.schema.id).toBe("line-breaks-launch-dark");
    expect({ ...keyed.schema, id: plain.schema.id }).toEqual(plain.schema);
  });

  it("keys nothing without a starter key or for an unknown blueprint", () => {
    const base: FidelityFixture = { name: "x", kind: "starter" };
    expect(resolveKeyedStarterFixture(base, undefined, workspace)).toBeNull();
    expect(
      resolveKeyedStarterFixture({ ...base, starter: "nope" }, undefined, workspace),
    ).toBeNull();
    expect(
      resolveKeyedStarterFixture(
        { ...base, kind: "figma", starter: "launch-01" },
        undefined,
        workspace,
      ),
    ).toBeNull();
  });
});

describe("file fixtures", () => {
  const schema = { id: "s", canvasWidth: 1080, canvasHeight: 1350 } as TemplateSchema;

  it("fills the renderer defaults the file leaves out", () => {
    const resolved = resolveFileFixture({ name: "x", kind: "figma", schema }, undefined)!;
    expect(resolved).toEqual({
      schema,
      values: {},
      brandKit: null,
      variantId: null,
      emptyFields: "placeholder",
      fonts: [],
    });
  });

  it("lets the address pick the variant over the file", () => {
    const fixture: FidelityFixture = { name: "x", kind: "figma", schema, variantId: "light" };
    expect(resolveFileFixture(fixture, "dark")!.variantId).toBe("dark");
    expect(resolveFileFixture(fixture, undefined)!.variantId).toBe("light");
  });

  it("has nothing to render without a schema", () => {
    expect(resolveFileFixture({ name: "x", kind: "figma" }, undefined)).toBeNull();
  });
});

describe("fixture fonts", () => {
  const font: FixtureFont = {
    family: "Brand Sans",
    file: "BrandSans-Bold.woff2",
    weight: 700,
    style: "normal",
  };

  it("serves a bare file name from beside the fixture and keeps root-relative paths", () => {
    expect(fixtureFontUrl("gtm-composer", font)).toBe(
      "/test/fidelity/fixtures/gtm-composer/BrandSans-Bold.woff2",
    );
    expect(
      fixtureFontUrl("gtm-composer", {
        ...font,
        file: "/test/fidelity/fonts-private/BrandSans-Bold.otf",
      }),
    ).toBe("/test/fidelity/fonts-private/BrandSans-Bold.otf");
  });

  it("registers as an uploaded font asset with its face and format", () => {
    const asset = fixtureFontAsset("gtm-composer", {
      ...font,
      file: "/test/fidelity/fonts-private/BrandSans-Bold.otf",
    });
    expect(asset.kind).toBe("font");
    expect(asset.url).toBe("/test/fidelity/fonts-private/BrandSans-Bold.otf");
    expect(asset.metadata).toEqual({
      family: "Brand Sans",
      weight: 700,
      style: "normal",
      format: "opentype",
    });
  });
});
