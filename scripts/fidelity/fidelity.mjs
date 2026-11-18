#!/usr/bin/env node
/**
 * The render fidelity harness (docs/brand-system/PHASE-0.md, Step 4).
 *
 *   node scripts/fidelity/fidelity.mjs run [--only a,b] [--engines chromium,firefox,webkit,webkit18]
 *   node scripts/fidelity/fidelity.mjs bless <name> [--approved]
 *   node scripts/fidelity/fidelity.mjs baseline <name> --approved [--engines …]
 *   node scripts/fidelity/fidelity.mjs fonts [--only a,b] [--engines …]
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
 * missing is reported as skipped, never as passed. A fixture with no golden
 * or no baseline for an engine is reported and, under CI, fails, so losing
 * either can't turn a regression green. The decisions live in
 * src/app/dev/fidelityVerdict.ts, which has tests.
 *
 * bless records today's Chromium render as a starter or synthetic
 * fixture's golden. It refuses to replace an existing golden without
 * --approved.
 *
 * Each comparison also reports a blurred share: the same threshold after a
 * 4px blur of both images, which keeps tone and shadow and drops grain
 * speckle (two grain patterns never match pixel for pixel). A fixture with
 * a blurBaseline fails when either share gets worse.
 *
 * baseline records the current changed and blurred shares as the
 * fixture's baseline and blurBaseline.
 * Only CJ approves a baseline, so it runs only with --approved.
 *
 * Google's fonts are pinned. Every request a fixture's page makes to
 * fonts.googleapis.com or fonts.gstatic.com is answered from the recording
 * in test/fidelity/google-fonts, never by Google (fontRecording.mjs says
 * why). A request the recording lacks fails the row that made it, unless
 * the fixture was skipped, and the run and report.json name it. fonts is
 * the one command that reaches Google: it renders the fixtures into
 * test/fidelity/out/fonts, fetches the answers the recording lacks and
 * writes them. It never fetches an answer it already has, and when it has
 * rendered every fixture in every engine it records for, it drops the
 * answers none of them asked for.
 *
 * The fourth engine, webkit18, is an older WebKit that stands in for
 * Safari before 26 (webkit18.mjs says what it is and installs it). It is
 * given WebKit's recorded fonts, so fonts leaves it out, and refuses it
 * when --engines names it.
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
import {
  outcomeWithFonts,
  recordingPart,
  sawEveryRequest,
  unrecordable,
} from "../../src/app/dev/fidelityFonts.ts";
import { DEFAULT_TOLERANCE, routeFor, verdictFor } from "../../src/app/dev/fidelityVerdict.ts";
import { openFontRecording } from "./fontRecording.mjs";
import { WEBKIT_18, webkit18 } from "./webkit18.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const fixturesDir = path.join(root, "test/fidelity/fixtures");
const outDir = path.join(root, "test/fidelity/out");
/** Google's recorded answers (fontRecording.mjs). */
const fontsDir = path.join(root, "test/fidelity/google-fonts");

const ENGINES = { chromium, firefox, webkit };
/** The engines the font recording holds answers for, which is what fonts
 * renders in. */
const RECORDED_ENGINES = Object.keys(ENGINES);
/** What run and baseline render in unless --engines says otherwise. */
const ALL_ENGINES = [...RECORDED_ENGINES, WEBKIT_18];
/** An engine's Playwright browser type. webkit18 comes from an older
 * Playwright, loaded only when a run renders in it. */
const browserType = (engine) => (engine === WEBKIT_18 ? webkit18() : ENGINES[engine]);
/** Larger than the biggest canvas (1080 x 1920 stories), at 1x. */
const VIEWPORT = { width: 2000, height: 2000 };
const FIXTURE_TIMEOUT_MS = 60_000;
/** The shots.mjs compare threshold: per channel, out of 255. */
const CHANNEL_THRESHOLD = 6;
/** The blurred share's blur (a canvas `blur()`, in px). */
const BLUR_PX = 4;
/** How long the harness's Firefox suppresses painting in a new document:
 * the pref nglayout.initialpaint.delay, in ms. Stock Firefox uses 5. Keep
 * it below SNAPSHOT_SETTLE_MS in src/lib/render/exportPng.ts (50); the
 * launch in renderEngine says why. */
const FIREFOX_PAINT_DELAY_MS = 40;

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
const engines = list(flags.engines) ?? (mode === "fonts" ? RECORDED_ENGINES : ALL_ENGINES);
for (const e of engines) if (!ENGINES[e] && e !== WEBKIT_18) usage();

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
/** A fixture's golden: its own, or the one `goldenFrom` names (the same
 * Figma frame rebuilt a second way). */
const goldenFile = (fixture) =>
  path.join(fixturesDir, fixture.goldenFrom ?? fixture.name, "golden.png");

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
/** Renders each fixture in one engine, its Google font requests answered
 * by `fonts` (openFontRecording). Returns name -> outcome:
 * { status: "rendered", file } | { status: "skipped", reason } |
 * { status: "error", message }. */
async function renderEngine(base, engine, fixtures, dir, fonts) {
  await mkdir(dir, { recursive: true });
  // Firefox is the one engine launched off stock settings, by one pref.
  // It suppresses painting for the first moments of every document's
  // life, the export snapshot's own document included, and a snapshot
  // drawn in that window loses everything clipped to text (a text
  // gradient, grain on glyphs). Stock Firefox ends the window after 5 ms,
  // so an export that draws too early loses the race only on a busy
  // machine, which reads as an occasional flake. Held open for
  // FIREFOX_PAINT_DELAY_MS, longer than a frame, that export loses on
  // every run. The real export passes because it waits SNAPSHOT_SETTLE_MS
  // on a timer set after the snapshot loads, which fires after Firefox's
  // for as long as its wait is the longer of the two.
  const browser = await browserType(engine).launch(
    engine === "firefox"
      ? { firefoxUserPrefs: { "nglayout.initialpaint.delay": FIREFOX_PAINT_DELAY_MS } }
      : {},
  );
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  const outcomes = new Map();
  try {
    for (const fixture of fixtures) {
      const page = await context.newPage();
      page.setDefaultTimeout(FIXTURE_TIMEOUT_MS);
      const pinned = await fonts.attach(page, engine);
      let outcome;
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
          outcome = { status: "error", message: result.error };
        } else if (result.missingFonts) {
          outcome = {
            status: "skipped",
            reason: `missing font ${result.missingFonts.join(", ")}`,
          };
        } else {
          const file = path.join(dir, `${fixture.name}.png`);
          await writeFile(file, Buffer.from(result.png, "base64"));
          outcome = { status: "rendered", file };
        }
      } catch (e) {
        outcome = {
          status: "error",
          message: e instanceof Error ? e.message.split("\n")[0] : String(e),
        };
      } finally {
        await pinned.settle();
        await page.close();
      }
      // A font request that went unanswered is an error, never a pass. A
      // skipped fixture rendered nothing, so what its page asked for
      // counts for nothing.
      const final = outcomeWithFonts(outcome, pinned.missed, fonts.record);
      if (final.status !== "skipped") pinned.keep();
      outcomes.set(fixture.name, final);
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
        async ({ golden, render, threshold, blurPx }) => {
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
          const read = (img, blur) => {
            const c = document.createElement("canvas");
            c.width = w;
            c.height = h;
            const ctx = c.getContext("2d");
            if (blur) ctx.filter = `blur(${blur}px)`;
            ctx.drawImage(img, 0, 0);
            return ctx.getImageData(0, 0, w, h);
          };
          // The blurred share: the same threshold after a blur of both
          // images, which keeps tone and shadow and drops grain speckle.
          const ba = read(a, blurPx).data;
          const bb = read(b, blurPx).data;
          let blurChanged = 0;
          for (let i = 0; i < ba.length; i += 4) {
            const d = Math.max(
              Math.abs(ba[i] - bb[i]),
              Math.abs(ba[i + 1] - bb[i + 1]),
              Math.abs(ba[i + 2] - bb[i + 2]),
            );
            if (d > threshold) blurChanged++;
          }
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
            blurChanged,
            total: w * h,
            golden: [a.width, a.height],
            render: [b.width, b.height],
            heatmap: c.toDataURL("image/png").replace(/^data:[^,]*,/, ""),
          };
        },
        { golden, render, threshold: CHANNEL_THRESHOLD, blurPx: BLUR_PX },
      );
      await writeFile(heatmap, Buffer.from(result.heatmap, "base64"));
      return {
        changedPct: (100 * result.changed) / result.total,
        blurPct: (100 * result.blurChanged) / result.total,
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

/** CI fails a fixture that has lost its golden or a baseline; a local run
 * reports it, which is how a new fixture gets its first numbers. */
const STRICT = Boolean(process.env.CI);

async function measure(fixtures, selectedEngines, fonts) {
  // An engine that is not installed is found here, before the dev server
  // starts, and not after the engines named ahead of it have rendered.
  for (const engine of selectedEngines) browserType(engine);
  const rendered = {};
  await withServer(async (base) => {
    for (const engine of selectedEngines) {
      rendered[engine] = await renderEngine(
        base,
        engine,
        fixtures,
        path.join(outDir, engine),
        fonts,
      );
    }
  });
  const comparer = await openComparer();
  const rows = [];
  try {
    for (const fixture of fixtures) {
      for (const engine of selectedEngines) {
        const outcome = rendered[engine].get(fixture.name);
        const golden = goldenFile(fixture);
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
        const { verdict, failed } = verdictFor(fixture, engine, outcome, cmp, STRICT);
        rows.push({
          fixture: fixture.name,
          engine,
          changedPct: cmp ? Number(cmp.changedPct.toFixed(4)) : null,
          baseline: fixture.baseline?.[engine] ?? null,
          blurPct: cmp ? Number(cmp.blurPct.toFixed(4)) : null,
          blurBaseline: fixture.blurBaseline?.[engine] ?? null,
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
      blurred: pct(r.blurPct),
      "blur base": pct(r.blurBaseline),
      verdict: r.verdict,
      ...(r.note ? { note: r.note } : {}),
    })),
  );
}

/** Names the font requests the recording could not answer, and the fix. */
function printUnanswered(fonts) {
  const requests = fonts.unanswered();
  if (!requests.length) return;
  console.error(
    fonts.record
      ? "Google font requests that could not be recorded:"
      : `Google font requests not in the recording (${rel(fontsDir)}):`,
  );
  for (const request of requests) console.error(`  ${request}`);
  if (!fonts.record) {
    console.error(
      "Run `node scripts/fidelity/fidelity.mjs fonts` to record them, then commit that folder.",
    );
    // webkit18 misses whatever WebKit misses, and fonts records those for
    // both. What it cannot record is a request WebKit did not make. A run
    // that did not render in WebKit cannot tell the two apart.
    const lost = unrecordable(requests);
    if (lost.length && engines.includes("webkit")) {
      console.error(
        `fonts cannot record what only ${WEBKIT_18} asked for (${lost.length} of these): it is given WebKit's answers (test/fidelity/README.md).`,
      );
    } else if (lost.length) {
      console.error(
        `fonts records for WebKit, whose answers ${WEBKIT_18} is given. What WebKit does not ask for too, it cannot record (test/fidelity/README.md).`,
      );
    }
  }
}

async function run() {
  const fixtures = await loadFixtures(list(flags.only));
  if (!fixtures.length) {
    console.log("No fixtures.");
    return;
  }
  const fonts = await openFontRecording(fontsDir);
  const rows = await measure(fixtures, engines, fonts);
  printTable(rows);
  printUnanswered(fonts);
  await mkdir(outDir, { recursive: true });
  await writeFile(
    path.join(outDir, "report.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        engines,
        unansweredFontRequests: fonts.unanswered(),
        rows,
      },
      null,
      2,
    ) + "\n",
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
  if (fixture.kind === "figma") {
    throw new Error(`${name} is a figma fixture; its golden comes from goldens.mjs fetch`);
  }
  if (fixture.goldenFrom) {
    throw new Error(`${name} compares with ${fixture.goldenFrom}'s golden; it has none of its own`);
  }
  const golden = goldenFile(fixture);
  if (existsSync(golden) && !flags.approved) {
    throw new Error(`${name} already has a golden. Replacing it needs CJ's approval (--approved).`);
  }
  const fonts = await openFontRecording(fontsDir);
  let outcome;
  await withServer(async (base) => {
    const dir = path.join(outDir, "chromium");
    outcome = (await renderEngine(base, "chromium", [fixture], dir, fonts)).get(name);
  });
  printUnanswered(fonts);
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
  const fonts = await openFontRecording(fontsDir);
  const rows = await measure([fixture], engines, fonts);
  printTable(rows);
  printUnanswered(fonts);
  const blocked = rows.filter((r) => r.changedPct === null || r.verdict === "size");
  if (blocked.length) {
    throw new Error(
      `No baseline recorded: ${blocked.map((r) => `${r.engine} (${r.verdict}${r.note ? `: ${r.note}` : ""})`).join(", ")}`,
    );
  }
  const next = { ...(fixture.baseline ?? {}) };
  const nextBlur = { ...(fixture.blurBaseline ?? {}) };
  for (const r of rows) {
    next[r.engine] = Number(r.changedPct.toFixed(2));
    nextBlur[r.engine] = Number(r.blurPct.toFixed(2));
  }
  await writeFixture(name, { ...fixture, baseline: next, blurBaseline: nextBlur });
  console.log(
    `${rel(fixtureFile(name))} baseline ${JSON.stringify(next)} blurBaseline ${JSON.stringify(nextBlur)}`,
  );
}

// ----------------------------------------------------------------- fonts
/** Records Google's answers to the font requests the recording lacks. */
async function recordFonts() {
  // Refused before anything starts; fontRecording.mjs refuses it again
  // where the fetch would happen.
  for (const engine of engines) recordingPart(engine, true);
  const only = list(flags.only);
  const fixtures = await loadFixtures(only);
  if (!fixtures.length) {
    console.log("No fixtures.");
    return;
  }
  const fonts = await openFontRecording(fontsDir, { record: true });
  const outcomes = [];
  let crash = null;
  try {
    await withServer(async (base) => {
      for (const engine of engines) {
        // Its own folder: run's renders, heatmaps and report stay a set.
        const dir = path.join(outDir, "fonts", engine);
        for (const [name, outcome] of await renderEngine(base, engine, fixtures, dir, fonts)) {
          outcomes.push({ name, engine, outcome });
        }
      }
    });
  } catch (e) {
    // What was fetched before the run broke is still worth keeping.
    crash = e;
  }
  // Only a run that rendered everything knows what nothing asks for.
  const prune =
    !crash &&
    sawEveryRequest({
      everyFixture: !only,
      everyEngine: RECORDED_ENGINES.every((e) => engines.includes(e)),
      outcomes: outcomes.map((o) => o.outcome),
    });
  const saved = await fonts.save({ prune });
  for (const request of saved.added) console.log(`added    ${request}`);
  for (const request of saved.removed) console.log(`removed  ${request}`);
  console.log(
    `${rel(fontsDir)}: ${saved.answers} answers in ${saved.files} files, ` +
      `${Math.round(saved.bytes / 1024)} KB (${saved.added.length} added, ${saved.removed.length} removed)`,
  );
  printUnanswered(fonts);
  for (const { name, engine, outcome } of outcomes) {
    if (outcome.status === "rendered") continue;
    console.error(`${name}/${engine} ${outcome.status}: ${outcome.message ?? outcome.reason}`);
    if (outcome.status === "error") process.exitCode = 1;
  }
  if (crash) throw crash;
}

try {
  if (mode === "run") await run();
  else if (mode === "bless" && positional[0]) await bless(positional[0]);
  else if (mode === "baseline" && positional[0]) await baseline(positional[0]);
  else if (mode === "fonts") await recordFonts();
  else usage();
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
