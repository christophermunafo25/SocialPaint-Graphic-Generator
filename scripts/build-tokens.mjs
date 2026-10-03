#!/usr/bin/env node
/* Builds src/styles/tokens.css from design/tokens/master.tokens.json.
 *
 * The JSON is exported from the Figma file "Master UX-UI"
 * (mEJRslarcQDkgPeY6AObi5), which is the source of truth for the platform's
 * tokens. Never edit tokens.css by hand: change Figma, re-export the JSON,
 * then run `npm run tokens`. `npm run tokens:check` fails when tokens.css is
 * out of date with the JSON, or when another stylesheet in src/styles
 * declares a name that tokens.css or legacy-bridge.css owns at theme level
 * (CI runs it through `npm run verify`).
 *
 * Output:
 *   :root                 primitives, radius, spacing, text styles
 *   [data-theme="light"]  brand tokens, Light values
 *   [data-theme="dark"]   brand tokens, Dark values
 *   [data-theme]          composites built from themed tokens (elevation,
 *                         glow), declared on every theme scope so a nested
 *                         [data-theme] recomputes them
 *   .t-*                  one class per text style, plus .t-trim
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
const cssVarOfPrimitive = (name) => {
  const p = tokens.primitives[name];
  if (!p) throw new Error(`Brand token points at unknown primitive "${name}"`);
  return `var(${p.css})`;
};
const cssVarOfAny = (name) => {
  if (tokens.primitives[name]) return `var(${tokens.primitives[name].css})`;
  if (tokens.brand[name] && tokens.brand[name].css) return `var(${tokens.brand[name].css})`;
  throw new Error(`Unknown token "${name}"`);
};
const brandValue = (v) =>
  typeof v === "string" && tokens.primitives[v] ? cssVarOfPrimitive(v) : color(v);

const FAMILY = {
  "Raveo Display": "var(--font-ui)",
  "Geist Mono": "var(--font-mono)",
  // Mono/Code is a documentation style in Figma; the app has no IBM Plex Mono.
  "IBM Plex Mono": "var(--font-code, var(--font-mono))",
};
const WEIGHT = { "Display Medium": 500, "Display Regular": 400, Regular: 400, Medium: 500 };
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
rootLines.push("/* Radius */");
for (const [, r] of Object.entries(tokens.radius)) rootLines.push(`${r.css}: ${px(r.value)};`);
rootLines.push("/* Spacing */");
for (const [, s] of Object.entries(tokens.spacing)) rootLines.push(`${s.css}: ${px(s.value)};`);

// text styles: one font shorthand and one tracking value per style
const styles = Object.entries(tokens.textStyles);
const twin = (name) => name.replace(/^Trimmed\//, "");
const classes = [];
rootLines.push("/* Text styles (font shorthand + tracking). Apply them with the .t-* classes. */");
for (const [name, s] of styles) {
  const isTrimmedTwin = name.startsWith("Trimmed/") && tokens.textStyles[twin(name)];
  if (isTrimmedTwin) continue; // the untrimmed twin's class plus .t-trim covers it
  const key = slug(twin(name));
  const fam = FAMILY[s.family];
  if (!fam) throw new Error(`No CSS family for "${s.family}" (${name})`);
  const weight = WEIGHT[s.style];
  if (!weight) throw new Error(`No weight for "${s.style}" (${name})`);
  rootLines.push(`--type-${key}: ${weight} ${s.size}px/${lineHeight(s.lineHeight)} ${fam};`);
  rootLines.push(`--type-${key}-tracking: ${tracking(s.letterSpacing)};`);
  const decl = [`font: var(--type-${key});`, `letter-spacing: var(--type-${key}-tracking);`];
  if (s.textCase === "UPPER") decl.push("text-transform: uppercase;");
  if (s.leadingTrim === "CAP_HEIGHT") decl.push("text-box: trim-both cap alphabetic;");
  classes.push(`.t-${key} {\n${decl.join("\n")}\n}`);
}

// ---------------------------------------------------------------- themes
const light = [];
const dark = [];
for (const [name, b] of Object.entries(tokens.brand)) {
  if (b.type === "boolean") continue; // theme/is-light|dark are the [data-theme] selectors themselves
  light.push(`${b.css}: ${brandValue(b.light)}; /* ${name} */`);
  dark.push(`${b.css}: ${brandValue(b.dark)}; /* ${name} */`);
}

// composites from effect styles
const composite = [];
for (const [name, effects] of Object.entries(tokens.effectStyles)) {
  const parts = [];
  for (const e of effects) {
    if (e.visible === false) continue;
    if (e.type !== "DROP_SHADOW" && e.type !== "INNER_SHADOW") continue;
    const c = e.colorVar ? cssVarOfAny(e.colorVar) : color(e.color);
    parts.push(
      `${e.type === "INNER_SHADOW" ? "inset " : ""}${px(e.x)} ${px(e.y)} ${px(e.blur)} ${px(e.spread || 0)} ${c}`,
    );
  }
  if (!parts.length) {
    composite.push(`/* ${name}: no CSS equivalent (${effects.map((e) => e.type).join(", ")}) */`);
    continue;
  }
  composite.push(`--${slug(name)}: ${parts.join(", ")};`);
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

[data-theme="light"] {
${light.join("\n")}
}

[data-theme="dark"] {
${dark.join("\n")}
}

[data-theme] {
${composite.join("\n")}
}

/* Text style classes. Pair a style with .t-trim for Figma's cap-height trim. */
${classes.join("\n\n")}

.t-trim {
text-box: trim-both cap alphabetic;
}
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
    /* no bridge (before Phase 1 or after Phase 9) */
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
    brand: Object.values(tokens.brand).filter((b) => b.type !== "boolean").length,
    radius: Object.keys(tokens.radius).length,
    spacing: Object.keys(tokens.spacing).length,
    textStyleClasses: classes.length,
    composites: composite.filter((l) => l.startsWith("--")).length,
  };
  console.log(`Wrote src/styles/tokens.css ${JSON.stringify(counts)}`);
}
