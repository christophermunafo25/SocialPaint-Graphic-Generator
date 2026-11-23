// SocialPaint token export (Figma development plugin).
//
// Run it in the Figma file "Master UX-UI New Brand Eleven Labs Inspired"
// (dQ8bQq3V7Bue5pvFrI2g9X): Plugins > Development > Import plugin from
// manifest, pick this folder's manifest.json, then run "SocialPaint token
// export" and save the file it offers as design/tokens/master.tokens.json.
// Then run `npm run tokens` in the repo.
//
// exportTokens() is plain Plugin API code, so a Claude session with the Figma
// connector can also run it through use_figma. That tool truncates long
// results, so return one section at a time and merge them.

const SOURCE = {
  figmaFile: "dQ8bQq3V7Bue5pvFrI2g9X",
  name: "Master UX-UI New Brand Eleven Labs Inspired",
};
const DESCRIPTION =
  'SocialPaint design tokens exported from the Figma file "Master UX-UI New Brand Eleven Labs Inspired" ' +
  "(dQ8bQq3V7Bue5pvFrI2g9X). This file is the source for src/styles/tokens.css. Do not edit " +
  "values here by hand: change the Figma variables or styles, re-export, then run `npm run tokens`.";

// The file's twenty text styles and six effect styles. Anything else in the
// file is not a token, and a missing one is an error.
const TEXT_STYLES = [
  "Title/Display",
  "Title/Metric",
  "Title/Page",
  "Title/Section",
  "Title/Group",
  "Title/Card",
  "Body/L",
  "Body/M",
  "Body/S",
  "Label/L",
  "Label/M",
  "Label/S",
  "Label/XS",
  "Caption/M",
  "Caption/S",
  "Mono/Display",
  "Mono/M",
  "Mono/S",
  "Mono/Eyebrow",
  "Mono/Code",
];
const EFFECT_STYLES = [
  "Elevation/1 Raised",
  "Elevation/2 Overlay",
  "Elevation/3 Floating",
  "Elevation/Thumb",
  "Glow/Accent",
  "Grain/Coarse",
];

async function exportTokens() {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const variables = await figma.variables.getLocalVariablesAsync();
  const byId = new Map(variables.map((v) => [v.id, v]));
  // Collections are found by exact name, never by position. The file holds
  // exactly one of each (checked 2026-11-17: Color has only the Light and
  // Dark modes, Scale only Value, and the v2 modes are gone).
  const collection = (name) => {
    const found = collections.filter((x) => x.name === name);
    if (found.length === 0) throw new Error(`Missing variable collection "${name}"`);
    if (found.length > 1)
      throw new Error(`${found.length} variable collections are named "${name}"`);
    return found[0];
  };
  const P = collection("Primitives");
  const C = collection("Color");
  const S = collection("Scale");

  const byte = (n) =>
    Math.round(n * 255)
      .toString(16)
      .padStart(2, "0");
  const hex = (c) => {
    const a = c.a === undefined ? 1 : c.a;
    return ("#" + byte(c.r) + byte(c.g) + byte(c.b) + (a < 1 ? byte(a) : "")).toUpperCase();
  };
  const round = (n) => Math.round(n * 100) / 100;
  const cssName = (v) => {
    const web = v.codeSyntax && v.codeSyntax.WEB;
    if (!web) throw new Error(`Variable "${v.name}" has no WEB code syntax`);
    return web.replace(/^var\((.*)\)$/, "$1");
  };
  const described = (entry, v) =>
    v.description ? { ...entry, description: v.description } : entry;
  const inOrder = (c) => c.variableIds.map((id) => byId.get(id)).filter(Boolean);
  const only = (v) => v.valuesByMode[Object.keys(v.valuesByMode)[0]];

  const primitives = {};
  for (const v of inOrder(P))
    primitives[v.name] = described({ css: cssName(v), value: hex(only(v)) }, v);

  // Every Color value is an alias to a primitive, exported as the primitive's
  // name. Anything else is an error in the file.
  const mode = (name) => {
    const m = C.modes.find((x) => x.name === name);
    if (!m) throw new Error(`The Color collection has no "${name}" mode`);
    return m.modeId;
  };
  const alias = (v, modeName) => {
    const value = v.valuesByMode[mode(modeName)];
    const target = value && value.type === "VARIABLE_ALIAS" ? byId.get(value.id) : null;
    if (!target || target.variableCollectionId !== P.id)
      throw new Error(`Color variable "${v.name}" is not an alias to a primitive in ${modeName}`);
    return { primitive: target.name, value: hex(only(target)) };
  };
  const color = {};
  for (const v of inOrder(C)) {
    const light = alias(v, "Light");
    const dark = alias(v, "Dark");
    color[v.name] = described(
      {
        css: cssName(v),
        light: light.primitive,
        dark: dark.primitive,
        resolved: { light: light.value, dark: dark.value },
        scopes: v.scopes,
      },
      v,
    );
  }

  // Scale holds numbers and strings. The generator reads the type and the
  // name to pick a unit.
  const scale = {};
  for (const v of inOrder(S)) {
    if (v.resolvedType !== "FLOAT" && v.resolvedType !== "STRING")
      throw new Error(`Scale variable "${v.name}" is ${v.resolvedType}, not a number or a string`);
    scale[v.name] = described({ css: cssName(v), type: v.resolvedType, value: only(v) }, v);
  }

  const unit = (m) =>
    m.unit === "AUTO" ? "AUTO" : `${round(m.value)}${m.unit === "PERCENT" ? "%" : "px"}`;
  const boundName = (s, field) => {
    const b = s.boundVariables && s.boundVariables[field];
    return b && byId.get(b.id) ? byId.get(b.id).name : null;
  };
  const localText = await figma.getLocalTextStylesAsync();
  const textStyles = {};
  for (const name of TEXT_STYLES) {
    const s = localText.find((x) => x.name === name);
    if (!s) throw new Error(`Missing text style "${name}"`);
    const entry = {
      family: s.fontName.family,
      style: s.fontName.style,
      size: s.fontSize,
      lineHeight: unit(s.lineHeight),
      letterSpacing: unit(s.letterSpacing),
      textCase: s.textCase,
      leadingTrim: s.leadingTrim,
    };
    const bound = {};
    for (const [key, field] of [
      ["size", "fontSize"],
      ["weight", "fontWeight"],
      ["family", "fontFamily"],
    ]) {
      const n = boundName(s, field);
      if (n) bound[key] = n;
    }
    if (Object.keys(bound).length) entry.bound = bound;
    textStyles[name] = entry;
  }

  const localEffects = await figma.getLocalEffectStylesAsync();
  const effectStyles = {};
  for (const name of EFFECT_STYLES) {
    const s = localEffects.find((x) => x.name === name);
    if (!s) throw new Error(`Missing effect style "${name}"`);
    effectStyles[name] = s.effects.map((e) => {
      const out = { type: e.type, visible: e.visible !== false };
      if (e.type === "DROP_SHADOW" || e.type === "INNER_SHADOW") {
        Object.assign(out, {
          x: e.offset.x,
          y: e.offset.y,
          blur: e.radius,
          spread: e.spread || 0,
          color: hex(e.color),
        });
      } else if (e.type === "NOISE") {
        Object.assign(out, {
          color: hex(e.color),
          noise: { size: e.noiseSize, density: e.density, kind: e.noiseType },
        });
      } else if ("radius" in e) {
        out.radius = e.radius;
      }
      const bound = e.boundVariables && e.boundVariables.color;
      if (bound && byId.get(bound.id)) out.colorVar = byId.get(bound.id).name;
      return out;
    });
  }

  const now = new Date();
  const exported = [now.getFullYear(), now.getMonth() + 1, now.getDate()]
    .map((n) => String(n).padStart(2, "0"))
    .join("-");
  return {
    $description: DESCRIPTION,
    source: { ...SOURCE, exported },
    primitives,
    color,
    scale,
    textStyles,
    effectStyles,
  };
}

if (typeof __html__ !== "undefined") {
  figma.showUI(__html__, { width: 380, height: 190 });
  exportTokens()
    .then((tokens) => {
      const counts = [
        Object.keys(tokens.primitives).length,
        Object.keys(tokens.color).length,
        Object.keys(tokens.scale).length,
      ];
      figma.ui.postMessage({
        json: JSON.stringify(tokens, null, 2) + "\n",
        summary:
          `${counts.reduce((a, b) => a + b, 0)} variables (${counts.join(", ")}), ` +
          `${Object.keys(tokens.textStyles).length} text styles, ` +
          `${Object.keys(tokens.effectStyles).length} effect styles` +
          (figma.root.name === SOURCE.name ? "" : ` (this file is "${figma.root.name}")`),
      });
    })
    .catch((err) =>
      figma.ui.postMessage({ error: String(err && err.message ? err.message : err) }),
    );
  figma.ui.onmessage = (msg) => {
    if (msg === "close") figma.closePlugin();
  };
}
