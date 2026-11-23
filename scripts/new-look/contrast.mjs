#!/usr/bin/env node
/* Contrast pass for the new look (PHASE-9 §9 D9).
 *
 *   node scripts/new-look/contrast.mjs <props.json> [--out report.json] [--baseline earlier.json]
 *
 * Reads a custom-property snapshot from `shots.mjs props` (every property's
 * resolved value at the root, in both themes) and the stylesheets in
 * src/styles, and computes WCAG contrast for two kinds of pair in each theme:
 *
 * - base: every text and icon colour token on every surface it is drawn on
 *   (page, raised, sunken, the input and control fills, selected);
 * - declared: every rule that sets both `color` and `background` (or
 *   `background-color`) to custom properties, as that rule pairs them.
 *
 * A translucent colour is composited over what sits under it: a background
 * over the page surface, a foreground over its background. Each pair is held
 * to 4.5:1 (text) and 3:1 (large text, icons and control edges); the report
 * lists every pair under 4.5 with the bar it misses. With --baseline it also
 * prints the pairs that got worse and the failures that were fixed, and exits
 * 1 when anything got worse. */
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const propsFile = args.find((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
if (!propsFile) {
  console.error("Usage: see the header of scripts/new-look/contrast.mjs");
  process.exit(2);
}

const FOREGROUNDS = [
  "--text-primary",
  "--text-secondary",
  "--feedback-error-text",
  "--border-focus",
];
const SURFACES = [
  "--surface-page",
  "--surface-raised",
  "--surface-sunken",
  "--surface-field",
  "--surface-card",
  "--state-selected",
];

// ---------------------------------------------------------------- colour
function parseColor(v) {
  if (!v) return null;
  v = v.trim().toLowerCase();
  if (v === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
  let m = v.match(/^#([0-9a-f]{3,8})$/);
  if (m) {
    let h = m[1];
    if (h.length <= 4) h = [...h].map((c) => c + c).join("");
    const n = (i) => parseInt(h.slice(i, i + 2), 16);
    return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) / 255 : 1 };
  }
  m = v.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/);
  if (m) {
    const a = m[4] === undefined ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : Number(m[4]);
    return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]), a };
  }
  return null;
}

const over = (top, under) => {
  const a = top.a + under.a * (1 - top.a);
  if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
  const mix = (x, y) => (x * top.a + y * under.a * (1 - top.a)) / a;
  return { r: mix(top.r, under.r), g: mix(top.g, under.g), b: mix(top.b, under.b), a };
};

const luminance = ({ r, g, b }) => {
  const lin = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};

const ratio = (fg, bg) => {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// ---------------------------------------------------------------- pairs
async function declaredPairs() {
  const dir = path.join(root, "src/styles");
  const pairs = [];
  for (const file of (await readdir(dir)).filter((f) => f.endsWith(".css")).sort()) {
    const css = (await readFile(path.join(dir, file), "utf8")).replace(/\/\*[\s\S]*?\*\//g, "");
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const body = m[2];
      const fg = body.match(/(?:^|;|\s)color\s*:\s*var\((--[\w-]+)\)/);
      const bg = body.match(/background(?:-color)?\s*:\s*var\((--[\w-]+)\)/);
      if (!fg || !bg) continue;
      pairs.push({
        kind: "declared",
        where: `${file}: ${m[1].trim().replace(/\s+/g, " ").slice(0, 80)}`,
        fg: fg[1],
        bg: bg[1],
      });
    }
  }
  return pairs;
}

function measure(pair, values) {
  const page = parseColor(values["--surface-page"]) ?? { r: 255, g: 255, b: 255, a: 1 };
  const fgRaw = parseColor(values[pair.fg]);
  const bgRaw = parseColor(values[pair.bg]);
  if (!fgRaw || !bgRaw) return null;
  const bg = over(bgRaw, page);
  const fg = over(fgRaw, bg);
  return Math.round(ratio(fg, bg) * 100) / 100;
}

// ---------------------------------------------------------------- main
const snapshot = JSON.parse(await readFile(propsFile, "utf8"));
const base = FOREGROUNDS.flatMap((fg) =>
  SURFACES.map((bg) => ({ kind: "base", where: "tokens", fg, bg })),
);
const pairs = [...base, ...(await declaredPairs())];
const rows = [];
for (const theme of ["light", "dark"]) {
  for (const p of pairs) {
    const r = measure(p, snapshot[theme] ?? {});
    if (r === null) continue;
    rows.push({
      theme,
      ...p,
      ratio: r,
      misses: r >= 4.5 ? "" : r >= 3 ? "text (4.5)" : "all (3)",
    });
  }
}
const key = (r) => `${r.theme} ${r.where} ${r.fg} on ${r.bg}`;
const failing = rows.filter((r) => r.misses);
console.log(
  `${rows.length} pairs measured; ${failing.length} under 4.5:1, ${failing.filter((r) => r.ratio < 3).length} under 3:1`,
);
if (failing.length) {
  console.table(
    failing
      .sort((a, b) => a.ratio - b.ratio)
      .map(({ theme, where, fg, bg, ratio, misses }) => ({ theme, where, fg, bg, ratio, misses })),
  );
}
const out = flag("out");
if (out) await writeFile(out, JSON.stringify(rows, null, 1));

const baselineFile = flag("baseline");
if (baselineFile) {
  const earlier = new Map(
    JSON.parse(await readFile(baselineFile, "utf8")).map((r) => [key(r), r.ratio]),
  );
  const worse = rows.filter((r) => earlier.has(key(r)) && r.ratio < earlier.get(key(r)) - 0.01);
  const fixed = rows.filter((r) => !r.misses && (earlier.get(key(r)) ?? 99) < 4.5);
  console.log(`\nAgainst ${baselineFile}: ${worse.length} worse, ${fixed.length} fixed`);
  if (worse.length) {
    console.table(
      worse.map((r) => ({ pair: key(r), before: earlier.get(key(r)), after: r.ratio })),
    );
  }
  if (fixed.length) console.table(fixed.map((r) => ({ pair: key(r), after: r.ratio })));
  process.exitCode = worse.length ? 1 : 0;
}
