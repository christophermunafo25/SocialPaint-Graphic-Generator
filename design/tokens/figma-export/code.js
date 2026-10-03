// SocialPaint token export (Figma development plugin).
//
// Run it in the Figma file "Master UX-UI" (mEJRslarcQDkgPeY6AObi5): Plugins >
// Development > Import plugin from manifest, pick this folder's manifest.json,
// then run "SocialPaint token export" and save the file it offers as
// design/tokens/master.tokens.json. Then run `npm run tokens` in the repo.
//
// exportTokens() is plain Plugin API code, so a Claude session with the Figma
// connector can also run it through use_figma. That tool truncates long
// results, so return one section at a time and merge them.

const SOURCE = { figmaFile: "mEJRslarcQDkgPeY6AObi5", name: "Master UX-UI" };
const DESCRIPTION =
  'SocialPaint design tokens exported from the Figma file "Master UX-UI" (mEJRslarcQDkgPeY6AObi5). ' +
  "This file is the source for src/styles/tokens.css. Do not edit values here by hand: change the " +
  "Figma variables or styles, re-export, then run `npm run tokens`.";

async function exportTokens() {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const variables = await figma.variables.getLocalVariablesAsync();
  const byId = new Map(variables.map((v) => [v.id, v]));
  const collection = (name) => {
    const c = collections.find((x) => x.name === name);
    if (!c) throw new Error(`Missing variable collection "${name}"`);
    return c;
  };
  const P = collection("Primitives");
  const B = collection("Brand");
  const R = collection("Radius");
  const S = collection("Spacing");

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
  const radius = {};
  for (const v of inOrder(R)) radius[v.name] = described({ css: cssName(v), value: only(v) }, v);
  const spacing = {};
  for (const v of inOrder(S)) spacing[v.name] = described({ css: cssName(v), value: only(v) }, v);

  // A Brand value is either an alias that ends at a primitive (exported as the
  // primitive's name) or a raw value (exported as hex).
  const mode = (name) => B.modes.find((m) => m.name === name).modeId;
  const follow = (value, modeId) => {
    let cur = value;
    for (let guard = 0; guard < 10 && cur && cur.type === "VARIABLE_ALIAS"; guard++) {
      const target = byId.get(cur.id);
      if (target.variableCollectionId === P.id)
        return { primitive: target.name, value: only(target) };
      cur = target.valuesByMode[modeId] !== undefined ? target.valuesByMode[modeId] : only(target);
    }
    return { primitive: null, value: cur };
  };
  const brand = {};
  for (const v of inOrder(B)) {
    const light = follow(v.valuesByMode[mode("Light")], mode("Light"));
    const dark = follow(v.valuesByMode[mode("Dark")], mode("Dark"));
    if (v.resolvedType === "BOOLEAN") {
      const theme = v.name.replace(/^theme\/is-/, "");
      brand[v.name] = {
        type: "boolean",
        selector: `[data-theme="${theme}"]`,
        light: light.value,
        dark: dark.value,
      };
      continue;
    }
    brand[v.name] = described(
      {
        css: cssName(v),
        light: light.primitive || hex(light.value),
        dark: dark.primitive || hex(dark.value),
        resolved: { light: hex(light.value), dark: hex(dark.value) },
        scopes: v.scopes,
      },
      v,
    );
  }

  const unit = (m) =>
    m.unit === "AUTO" ? "AUTO" : `${round(m.value)}${m.unit === "PERCENT" ? "%" : "px"}`;
  const textStyles = {};
  for (const s of await figma.getLocalTextStylesAsync()) {
    textStyles[s.name] = {
      family: s.fontName.family,
      style: s.fontName.style,
      size: s.fontSize,
      lineHeight: unit(s.lineHeight),
      letterSpacing: unit(s.letterSpacing),
      textCase: s.textCase,
      leadingTrim: s.leadingTrim,
    };
  }

  const effectStyles = {};
  for (const s of await figma.getLocalEffectStylesAsync()) {
    effectStyles[s.name] = s.effects.map((e) => {
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
    radius,
    spacing,
    brand,
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
        Object.keys(tokens.brand).length,
        Object.keys(tokens.radius).length,
        Object.keys(tokens.spacing).length,
      ];
      figma.ui.postMessage({
        json: JSON.stringify(tokens, null, 2) + "\n",
        summary:
          `${counts.reduce((a, b) => a + b, 0)} variables, ` +
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
