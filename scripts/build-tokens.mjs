#!/usr/bin/env node
/* Builds src/styles/tokens.css from design/tokens/master.tokens.json.
 *
 * The JSON is exported from the Figma file "Master UX-UI New Brand Eleven Labs
 * Inspired" (dQ8bQq3V7Bue5pvFrI2g9X), which is the source of truth for the platform's
 * tokens. Never edit tokens.css by hand: change Figma, re-export the JSON,
 * then run `npm run tokens`. `npm run tokens:check` fails when tokens.css is
 * out of date with the JSON, or when another stylesheet in src/styles
 * declares a name that tokens.css or legacy-bridge.css owns at theme level
 * (CI runs it through `npm run verify`).
 *
 * Output:
 *   :root                 primitives, the Scale collection, text styles
 *   @media reduced motion the motion durations at zero
 *   [data-theme="light"]  Color tokens, Light values
 *   [data-theme="dark"]   Color tokens, Dark values
 *   [data-theme]          composites built from themed tokens (elevation,
 *                         glow), declared on every theme scope so a nested
 *                         [data-theme] recomputes them
 *   .t-*                  one class per text style, trimmed to cap height
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import prettier from "prettier";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(root, "design/tokens/master.tokens.json");
const OUT = path.join(root, "src/styles/tokens.css");
const check = process.argv.includes("--check");

const tokens = JSON.parse(await readFile(SRC, "utf8"));

// ---------------------------------------------------------------- helpers
const color = (hex) => {
  const h = hex.replace("#", "").toLowerCase();
  if (h.length === 6) return `#${h}`;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  const a = Math.round((parseInt(h.slice(6, 8), 16) / 255) * 100) / 100;
  return `rgb(${r} ${g} ${b} / ${a})`;
};
const px = (n) => (n === 0 ? "0" : `${n}px`);
const slug = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9/]+/g, "-")
    .replace(/\//g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
const cssVarOfPrimitive = (name, owner) => {
  const p = tokens.primitives[name];
  if (!p) throw new Error(`${owner} points at unknown primitive "${name}"`);
  return `var(${p.css})`;
};
const cssVarOfColor = (name, owner) => {
  const c = tokens.color[name];
  if (!c) throw new Error(`${owner} is bound to unknown Color token "${name}"`);
  return `var(${c.css})`;
};
const cssVarOfScale = (name, owner) => {
  const s = tokens.scale[name];
  if (!s) throw new Error(`${owner} is bound to unknown Scale token "${name}"`);
  return `var(${s.css})`;
};

// Figma holds the public family names. The app registers its chrome faces
// under private names so a tenant's font can never collide with them
// (docs/design/new-brand/RULES.md section 5), so the font tokens are written
// as these stacks. A family that is not here fails the build.
const FAMILY_STACK = {
  "Inter Tight": '"Inter Tight Platform", system-ui, -apple-system, sans-serif',
  "Geist Mono": '"Geist Mono", ui-monospace, "SF Mono", Menlo, monospace',
};
const WEIGHT = { Regular: 400, Medium: 500 };
const lineHeight = (v) =>
  v === "AUTO" ? "normal" : v.endsWith("%") ? String(parseFloat(v) / 100) : v;
const tracking = (v) => {
  const n = parseFloat(v);
  if (!n) return "0";
  return v.endsWith("%") ? `${Math.round(n * 10) / 1000}em` : v;
};

// ---------------------------------------------------------------- :root
const rootLines = [];
rootLines.push("/* Primitives: raw values. Components never read these directly. */");
for (const [, p] of Object.entries(tokens.primitives))
  rootLines.push(`${p.css}: ${color(p.value)};`);

// Scale: the unit comes from the token's type and its name. A name that
// matches no rule fails the build, so a new group in Figma is a decision
// here and never a silent guess.
const LENGTH = /^--(space|radius|size|type-size|layout)-|^--stroke-|^--focus-offset$/;
const scaleValue = (name, s) => {
  if (s.type === "STRING") {
    if (/^--font-/.test(s.css)) {
      const stack = FAMILY_STACK[s.value];
      if (!stack) throw new Error(`No font stack for "${s.value}" (${name})`);
      return stack;
    }
    if (/^--motion-easing-/.test(s.css)) return s.value;
  } else if (s.type === "FLOAT") {
    if (LENGTH.test(s.css)) return px(s.value);
    if (/^--type-weight-/.test(s.css)) return String(s.value);
    if (/^--motion-duration-/.test(s.css)) return `${s.value}ms`;
  }
  throw new Error(`No unit rule for Scale token "${name}" (${s.css}, ${s.type})`);
};
rootLines.push("/* Scale: spacing, radius, sizes, strokes, type, fonts and motion. */");
const durations = [];
for (const [name, s] of Object.entries(tokens.scale)) {
  rootLines.push(`${s.css}: ${scaleValue(name, s)};`);
  if (/^--motion-duration-/.test(s.css) && s.value !== 0) durations.push(s.css);
}

// text styles: one font shorthand and one tracking value per style, and one
// class each. Every style trims to cap height, as the file has them.
const classes = [];
rootLines.push("/* Text styles (font shorthand + tracking). Apply them with the .t-* classes. */");
for (const [name, s] of Object.entries(tokens.textStyles)) {
  const key = slug(name);
  if (!FAMILY_STACK[s.family]) throw new Error(`No font stack for "${s.family}" (${name})`);
  const weight = WEIGHT[s.style];
  if (!weight) throw new Error(`No weight for "${s.style}" (${name})`);
  if (s.leadingTrim !== "CAP_HEIGHT")
    throw new Error(`Text style "${name}" does not trim to cap height`);
  const fam = s.bound?.family ? cssVarOfScale(s.bound.family, name) : FAMILY_STACK[s.family];
  rootLines.push(`--type-${key}: ${weight} ${s.size}px/${lineHeight(s.lineHeight)} ${fam};`);
  rootLines.push(`--type-${key}-tracking: ${tracking(s.letterSpacing)};`);
  const decl = [`font: var(--type-${key});`, `letter-spacing: var(--type-${key}-tracking);`];
  if (s.textCase === "UPPER") decl.push("text-transform: uppercase;");
  decl.push("text-box: trim-both cap alphabetic;");
  classes.push(`.t-${key} {\n${decl.join("\n")}\n}`);
}

// ---------------------------------------------------------------- themes
const light = [];
const dark = [];
for (const [name, c] of Object.entries(tokens.color)) {
  light.push(`${c.css}: ${cssVarOfPrimitive(c.light, name)}; /* ${name} */`);
  dark.push(`${c.css}: ${cssVarOfPrimitive(c.dark, name)}; /* ${name} */`);
}

// composites from effect styles. Effect styles carry no code syntax, so a
// composite is named after its style. A name a Color token already has
// (Glow/Accent's color is glow/accent) takes a -shadow suffix.
const colorNames = new Set(Object.values(tokens.color).map((c) => c.css));
const composite = [];
for (const [name, effects] of Object.entries(tokens.effectStyles)) {
  const parts = [];
  for (const e of effects) {
    if (e.visible === false) continue;
    if (e.type !== "DROP_SHADOW" && e.type !== "INNER_SHADOW") continue;
    const c = e.colorVar ? cssVarOfColor(e.colorVar, name) : color(e.color);
    parts.push(
      `${e.type === "INNER_SHADOW" ? "inset " : ""}${px(e.x)} ${px(e.y)} ${px(e.blur)} ${px(e.spread || 0)} ${c}`,
    );
  }
  if (!parts.length) {
    composite.push(`/* ${name}: no CSS equivalent (${effects.map((e) => e.type).join(", ")}) */`);
    continue;
  }
  const base = `--${slug(name)}`;
  composite.push(`${colorNames.has(base) ? `${base}-shadow` : base}: ${parts.join(", ")};`);
}

// ---------------------------------------------------------------- write
const header = `/* GENERATED FILE. Do not edit.
   Source: design/tokens/master.tokens.json, exported ${tokens.source.exported} from the Figma
   file "${tokens.source.name}" (${tokens.source.figmaFile}).
   Rebuild: npm run tokens. CI fails if this file and the JSON disagree. */`;
const css = `${header}

:root {
${rootLines.join("\n")}
}

/* With reduced motion on, durations are zero. */
@media (prefers-reduced-motion: reduce) {
:root {
${durations.map((d) => `${d}: 0ms;`).join("\n")}
}
}

[data-theme="light"] {
${light.join("\n")}
}

[data-theme="dark"] {
${dark.join("\n")}
}

[data-theme] {
${composite.join("\n")}
}

/* Text style classes, one per Figma text style. Each trims to cap height. */
${classes.join("\n\n")}
`;

const options = (await prettier.resolveConfig(OUT)) ?? {};
const formatted = await prettier.format(css, { ...options, parser: "css", filepath: OUT });

// ---------------------------------------------------------------- shadows
// A token is defined once. Another stylesheet may override one inside a
// component selector, but a theme-level declaration (:root, html, .dark or
// [data-theme...], bare or inside @media) of a name that tokens.css or the
// legacy bridge owns would shadow it, so --check fails on it.
const THEME_SELECTOR = /^(:root|html|\.dark|\[data-theme(="(light|dark)")?\])$/;
const declaredNames = (text) => new Set(text.match(/--[\w-]+(?=\s*:)/g) ?? []);
const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "));

function themeLevelDeclarations(text) {
  const found = [];
  const stack = [];
  let buf = "";
  let line = 1;
  let declLine = 0;
  for (const ch of stripComments(text)) {
    if (ch === "{") {
      stack.push(buf.trim().replace(/\s+/g, " "));
      buf = "";
    } else if (ch === "}") {
      stack.pop();
      buf = "";
    } else if (ch === ";") {
      const m = buf.trim().match(/^(--[\w-]+)\s*:/);
      const selectors = stack.filter((s) => !s.startsWith("@media") && !s.startsWith("@supports"));
      const themeLevel =
        selectors.length > 0 &&
        selectors.every((s) => s.split(",").every((part) => THEME_SELECTOR.test(part.trim())));
      if (m && themeLevel) found.push({ name: m[1], line: declLine, scope: stack.join(" > ") });
      buf = "";
    } else {
      if (!buf.trim() && ch.trim()) declLine = line;
      buf += ch;
    }
    if (ch === "\n") line += 1;
  }
  return found;
}

async function findShadows() {
  const stylesDir = path.dirname(OUT);
  const bridgePath = path.join(stylesDir, "legacy-bridge.css");
  const owned = declaredNames(formatted);
  let bridged = new Set();
  try {
    const bridge = await readFile(bridgePath, "utf8");
    bridged = declaredNames(stripComments(bridge));
    for (const name of bridged) {
      if (owned.has(name)) {
        problems.push(`legacy-bridge.css redefines ${name}, which tokens.css owns`);
      }
    }
  } catch {
    /* no bridge (after the new-brand program's Phase 10) */
  }
  const files = (await readdir(stylesDir)).filter(
    (f) => f.endsWith(".css") && !["tokens.css", "legacy-bridge.css"].includes(f),
  );
  for (const file of files) {
    const text = await readFile(path.join(stylesDir, file), "utf8");
    for (const d of themeLevelDeclarations(text)) {
      if (owned.has(d.name) || bridged.has(d.name)) {
        const owner = owned.has(d.name) ? "tokens.css" : "legacy-bridge.css";
        problems.push(`${file}:${d.line} declares ${d.name} in ${d.scope}; ${owner} owns it`);
      }
    }
  }
}

const problems = [];
if (check) {
  let current = "";
  try {
    current = await readFile(OUT, "utf8");
  } catch {
    /* missing file counts as stale */
  }
  if (current !== formatted) {
    problems.push("src/styles/tokens.css is out of date. Run `npm run tokens`.");
  }
  await findShadows();
  if (problems.length) {
    for (const p of problems) console.error(p);
    process.exit(1);
  }
  console.log("tokens.css is up to date, and no stylesheet shadows a token.");
} else {
  await writeFile(OUT, formatted);
  const counts = {
    primitives: Object.keys(tokens.primitives).length,
    color: Object.keys(tokens.color).length,
    scale: Object.keys(tokens.scale).length,
    textStyleClasses: classes.length,
    composites: composite.filter((l) => l.startsWith("--")).length,
  };
  console.log(`Wrote src/styles/tokens.css ${JSON.stringify(counts)}`);
}
