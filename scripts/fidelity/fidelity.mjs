#!/usr/bin/env node
/**
 * The render fidelity harness (docs/brand-system/PHASE-0.md, Step 4).
 *
 *   node scripts/fidelity/fidelity.mjs run [--only a,b] [--engines chromium,firefox,webkit]
 *   node scripts/fidelity/fidelity.mjs bless <name> [--approved]
 *   node scripts/fidelity/fidelity.mjs baseline <name> --approved [--engines …]
 *
 * run renders every fixture in test/fidelity/fixtures through the dev render
 * page (/dev/render/:fixture, window.__spFidelity) and the real export path,
 * saves test/fidelity/out/<engine>/<name>.png, compares it with the
 * fixture's golden.png (the shots.mjs compare: a pixel changes when any
 * channel differs by more than 6), saves <name>.heatmap.png (changed pixels
 * in magenta), prints a table and writes test/fidelity/out/report.json.
 * It exits non-zero when a render errors, when its size differs from its
 * golden, or when its changed share exceeds the baseline by more than the
 * fixture's tolerance (default 0.25 points). A fixture whose font file is
 * missing, or that has no golden, is reported as skipped, never as passed.
 *
 * bless records today's Chromium render as a starter fixture's golden. It
 * refuses to replace an existing golden without --approved.
 *
 * baseline records the current changed shares as the fixture's baseline.
 * Only CJ approves a baseline, so it runs only with --approved.
 *
 * The harness starts its own Vite dev server on the local backend (the
 * shots.mjs approach; --port, default 4327) unless --base points at one.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, firefox, webkit } from "playwright";
import * as prettier from "prettier";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const fixturesDir = path.join(root, "test/fidelity/fixtures");
const outDir = path.join(root, "test/fidelity/out");

const ENGINES = { chromium, firefox, webkit };
const ALL_ENGINES = Object.keys(ENGINES);
const DEFAULT_TOLERANCE = 0.25;
/** Larger than the biggest canvas (1080 x 1920 stories), at 1x. */
const VIEWPORT = { width: 2000, height: 2000 };
const FIXTURE_TIMEOUT_MS = 60_000;
/** The shots.mjs compare threshold: per channel, out of 255. */
const CHANNEL_THRESHOLD = 6;

// ------------------------------------------------------------------ args
const [mode, ...rest] = process.argv.slice(2);
const flags = {};
const positional = [];
const BOOLEAN_FLAGS = new Set(["approved"]);
for (let i = 0; i < rest.length; i++) {
  const arg = rest[i];
  if (!arg.startsWith("--")) {
    positional.push(arg);
    continue;
  }
  const key = arg.slice(2);
  if (BOOLEAN_FLAGS.has(key)) flags[key] = true;
  else flags[key] = rest[++i];
}

const usage = () => {
  console.error("Usage: see the header of scripts/fidelity/fidelity.mjs");
  process.exit(2);
};

const list = (v) =>
  v
    ? v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : null;
const engines = list(flags.engines) ?? ALL_ENGINES;
for (const e of engines) if (!ENGINES[e]) usage();

// -------------------------------------------------------------- fixtures
async function loadFixtures(only) {
  if (!existsSync(fixturesDir)) return [];
  const names = (await readdir(fixturesDir, { withFileTypes: true }))
    .filter((d) => d.isDirectory() && existsSync(path.join(fixturesDir, d.name, "fixture.json")))
    .map((d) => d.name)
    .sort();
  const fixtures = [];
  for (const name of names) {
    if (only && !only.includes(name)) continue;
    const fixture = JSON.parse(await readFile(fixtureFile(name), "utf8"));
    fixtures.push({ ...fixture, name });
  }
  if (only) {
    for (const name of only) {
      if (!fixtures.some((f) => f.name === name)) throw new Error(`No fixture named ${name}`);
    }
  }
  return fixtures;
}

const fixtureFile = (name) => path.join(fixturesDir, name, "fixture.json");
const goldenFile = (name) => path.join(fixturesDir, name, "golden.png");

/** The dev render address for a fixture. A starter fixture named
 * starter-<key>-dark with variantId "dark" renders blueprint <key> in its
 * Dark colourway; a figma fixture renders its own file. */
function routeFor(fixture) {
  if (fixture.kind === "starter") {
    let key = fixture.name.slice("starter-".length);
    const variant = fixture.variantId;
    if (variant && key.endsWith(`-${variant}`)) key = key.slice(0, -(variant.length + 1));
    const route = `/dev/render/starter-${encodeURIComponent(key)}`;
    return variant ? `${route}?variant=${encodeURIComponent(variant)}` : route;
  }
  return `/dev/render/${encodeURIComponent(fixture.name)}`;
}

async function writeFixture(name, fixture) {
  const file = fixtureFile(name);
  const { name: _name, ...body } = fixture;
  const config = (await prettier.resolveConfig(file)) ?? {};
  const json = await prettier.format(JSON.stringify({ name, ...body }), {
    ...config,
    filepath: file,
  });
  await writeFile(file, json);
}

// ---------------------------------------------------------------- server
async function withServer(fn) {
  if (flags.base) return fn(flags.base.replace(/\/$/, ""));
  const port = Number(flags.port ?? 4327);
  const base = `http://127.0.0.1:${port}`;
  const vite = path.join(root, "node_modules/vite/bin/vite.js");
  const child = spawn(
    process.execPath,
    [vite, "--port", String(port), "--strictPort", "--host", "127.0.0.1"],
    {
      cwd: root,
      env: { ...process.env, VITE_SUPABASE_URL: "", VITE_SUPABASE_ANON_KEY: "" },
      stdio: ["ignore", "ignore", "inherit"],
    },
  );
  try {
    const deadline = Date.now() + 60_000;
    for (;;) {
      try {
        if ((await fetch(base)).ok) break;
      } catch {
        /* not up yet */
      }
      if (Date.now() > deadline) throw new Error(`Dev server did not start on ${base}`);
      await new Promise((r) => setTimeout(r, 300));
    }
    return await fn(base);
  } finally {
    child.kill();
  }
}

// ---------------------------------------------------------------- render
/** Renders each fixture in one engine. Returns name -> outcome:
 * { status: "rendered", file } | { status: "skipped", reason } |
 * { status: "error", message }. */
async function renderEngine(base, engine, fixtures, dir) {
  await mkdir(dir, { recursive: true });
  const browser = await ENGINES[engine].launch();
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  const outcomes = new Map();
  try {
    for (const fixture of fixtures) {
      const page = await context.newPage();
      page.setDefaultTimeout(FIXTURE_TIMEOUT_MS);
      try {
        await page.goto(base + routeFor(fixture), { waitUntil: "domcontentloaded" });
        await page.waitForFunction(() => window.__spFidelity);
        const result = await page.evaluate(async () => {
          try {
            const ready = await window.__spFidelity.ready;
            if (ready.missingFonts.length) return { missingFonts: ready.missingFonts };
            return { png: await window.__spFidelity.render() };
          } catch (e) {
            return { error: e instanceof Error ? e.message : String(e) };
          }
        });
        if (result.error) {
          outcomes.set(fixture.name, { status: "error", message: result.error });
        } else if (result.missingFonts) {
          outcomes.set(fixture.name, {
            status: "skipped",
            reason: `missing font ${result.missingFonts.join(", ")}`,
          });
        } else {
          const file = path.join(dir, `${fixture.name}.png`);
          await writeFile(file, Buffer.from(result.png, "base64"));
          outcomes.set(fixture.name, { status: "rendered", file });
        }
      } catch (e) {
        outcomes.set(fixture.name, {
          status: "error",
          message: e instanceof Error ? e.message.split("\n")[0] : String(e),
        });
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
  return outcomes;
}

// --------------------------------------------------------------- compare
/** The shots.mjs compare on one Chromium page: both images on one origin,
 * read through a canvas, a pixel changed when any RGB channel differs by
 * more than 6. Sizes that differ compare their overlap from the top left. */
async function openComparer() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.route("http://fidelity.local/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/") return route.fulfill({ contentType: "text/html", body: "<body>" });
    const file = decodeURIComponent(url.pathname.slice("/file/".length));
    return route.fulfill({ contentType: "image/png", body: await readFile(file) });
  });
  await page.goto("http://fidelity.local/");
  return {
    async compare(golden, render, heatmap) {
      const result = await page.evaluate(
        async ({ golden, render, threshold }) => {
          const load = (src) =>
            new Promise((resolve, reject) => {
              const img = new Image();
              img.onload = () => resolve(img);
              img.onerror = () => reject(new Error(`Could not load ${src}`));
              img.src = src;
            });
          const [a, b] = await Promise.all([
            load(`/file/${encodeURIComponent(golden)}`),
            load(`/file/${encodeURIComponent(render)}`),
          ]);
          const w = Math.min(a.width, b.width);
          const h = Math.min(a.height, b.height);
          const read = (img) => {
            const c = document.createElement("canvas");
            c.width = w;
            c.height = h;
            const ctx = c.getContext("2d");
            ctx.drawImage(img, 0, 0);
            return ctx.getImageData(0, 0, w, h);
          };
          const pa = read(a).data;
          const out = read(b);
          const pb = out.data;
          let changed = 0;
          for (let i = 0; i < pa.length; i += 4) {
            const d = Math.max(
              Math.abs(pa[i] - pb[i]),
              Math.abs(pa[i + 1] - pb[i + 1]),
              Math.abs(pa[i + 2] - pb[i + 2]),
            );
            if (d > threshold) {
              changed++;
              pb[i] = 255;
              pb[i + 1] = 0;
              pb[i + 2] = 200;
            } else {
              pb[i] = pb[i] * 0.5;
              pb[i + 1] = pb[i + 1] * 0.5;
              pb[i + 2] = pb[i + 2] * 0.5;
            }
            pb[i + 3] = 255;
          }
          const c = document.createElement("canvas");
          c.width = w;
          c.height = h;
          c.getContext("2d").putImageData(out, 0, 0);
          return {
            changed,
            total: w * h,
            golden: [a.width, a.height],
            render: [b.width, b.height],
            heatmap: c.toDataURL("image/png").replace(/^data:[^,]*,/, ""),
          };
        },
        { golden, render, threshold: CHANNEL_THRESHOLD },
      );
      await writeFile(heatmap, Buffer.from(result.heatmap, "base64"));
      return {
        changedPct: (100 * result.changed) / result.total,
        sizeMatches: result.golden[0] === result.render[0] && result.golden[1] === result.render[1],
        golden: result.golden,
        render: result.render,
      };
    },
    close: () => browser.close(),
  };
}

// ------------------------------------------------------------------- run
const rel = (p) => path.relative(root, p);
const pct = (v) => (v === undefined || v === null ? "" : `${v.toFixed(2)}%`);

function verdictFor(fixture, engine, outcome, cmp) {
  if (outcome.status === "skipped") return { verdict: "skipped", failed: false };
  if (outcome.status === "error") return { verdict: "error", failed: true };
  if (!cmp) return { verdict: "skipped", failed: false };
  if (!cmp.sizeMatches) return { verdict: "size", failed: true };
  const baseline = fixture.baseline?.[engine];
  if (baseline === undefined) return { verdict: "no baseline", failed: false };
  const tolerance = fixture.tolerance ?? DEFAULT_TOLERANCE;
  if (cmp.changedPct > baseline + tolerance) return { verdict: "worse", failed: true };
  if (cmp.changedPct < baseline - tolerance) return { verdict: "better", failed: false };
  return { verdict: "pass", failed: false };
}

async function measure(fixtures, selectedEngines) {
  const rendered = {};
  await withServer(async (base) => {
    for (const engine of selectedEngines) {
      rendered[engine] = await renderEngine(base, engine, fixtures, path.join(outDir, engine));
    }
  });
  const comparer = await openComparer();
  const rows = [];
  try {
    for (const fixture of fixtures) {
      for (const engine of selectedEngines) {
        const outcome = rendered[engine].get(fixture.name);
        const golden = goldenFile(fixture.name);
        let cmp = null;
        let note = outcome.status === "skipped" ? outcome.reason : outcome.message;
        let heatmap;
        if (outcome.status === "rendered") {
          if (existsSync(golden)) {
            heatmap = path.join(outDir, engine, `${fixture.name}.heatmap.png`);
            cmp = await comparer.compare(golden, outcome.file, heatmap);
            if (!cmp.sizeMatches) {
              note = `render ${cmp.render.join("x")}, golden ${cmp.golden.join("x")}`;
            }
          } else {
            note = "no golden";
          }
        }
        const { verdict, failed } = verdictFor(fixture, engine, outcome, cmp);
        rows.push({
          fixture: fixture.name,
          engine,
          changedPct: cmp ? Number(cmp.changedPct.toFixed(4)) : null,
          baseline: fixture.baseline?.[engine] ?? null,
          tolerance: fixture.tolerance ?? DEFAULT_TOLERANCE,
          verdict,
          failed,
          note: note ?? "",
          render: outcome.status === "rendered" ? rel(outcome.file) : null,
          heatmap: heatmap ? rel(heatmap) : null,
        });
      }
    }
  } finally {
    await comparer.close();
  }
  return rows;
}

function printTable(rows) {
  console.table(
    rows.map((r) => ({
      fixture: r.fixture,
      engine: r.engine,
      changed: pct(r.changedPct),
      baseline: pct(r.baseline),
      verdict: r.verdict,
      ...(r.note ? { note: r.note } : {}),
    })),
  );
}

async function run() {
  const fixtures = await loadFixtures(list(flags.only));
  if (!fixtures.length) {
    console.log("No fixtures.");
    return;
  }
  const rows = await measure(fixtures, engines);
  printTable(rows);
  await mkdir(outDir, { recursive: true });
  await writeFile(
    path.join(outDir, "report.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), engines, rows }, null, 2) + "\n",
  );
  const failures = rows.filter((r) => r.failed);
  if (failures.length) {
    console.error(
      `${failures.length} failing: ${failures.map((r) => `${r.fixture}/${r.engine} (${r.verdict})`).join(", ")}`,
    );
    process.exitCode = 1;
  }
}

// ----------------------------------------------------------------- bless
async function bless(name) {
  const [fixture] = await loadFixtures([name]);
  if (fixture.kind !== "starter") {
    throw new Error(`${name} is a figma fixture; its golden comes from goldens.mjs fetch`);
  }
  const golden = goldenFile(name);
  if (existsSync(golden) && !flags.approved) {
    throw new Error(`${name} already has a golden. Replacing it needs CJ's approval (--approved).`);
  }
  let outcome;
  await withServer(async (base) => {
    const dir = path.join(outDir, "chromium");
    outcome = (await renderEngine(base, "chromium", [fixture], dir)).get(name);
  });
  if (outcome.status !== "rendered") {
    throw new Error(`${name} did not render: ${outcome.message ?? outcome.reason}`);
  }
  await copyFile(outcome.file, golden);
  console.log(`${rel(golden)} blessed from Chromium`);
}

// -------------------------------------------------------------- baseline
async function baseline(name) {
  if (!flags.approved) {
    throw new Error("Only CJ approves a baseline. Run with --approved once CJ has.");
  }
  const [fixture] = await loadFixtures([name]);
  const rows = await measure([fixture], engines);
  printTable(rows);
  const blocked = rows.filter((r) => r.changedPct === null || r.verdict === "size");
  if (blocked.length) {
    throw new Error(
      `No baseline recorded: ${blocked.map((r) => `${r.engine} (${r.verdict}${r.note ? `: ${r.note}` : ""})`).join(", ")}`,
    );
  }
  const next = { ...(fixture.baseline ?? {}) };
  for (const r of rows) next[r.engine] = Number(r.changedPct.toFixed(2));
  await writeFixture(name, { ...fixture, baseline: next });
  console.log(`${rel(fixtureFile(name))} baseline ${JSON.stringify(next)}`);
}

try {
  if (mode === "run") await run();
  else if (mode === "bless" && positional[0]) await bless(positional[0]);
  else if (mode === "baseline" && positional[0]) await baseline(positional[0]);
  else usage();
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
