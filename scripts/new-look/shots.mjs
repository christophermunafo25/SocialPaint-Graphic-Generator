#!/usr/bin/env node
/* Screenshot loop for the new look. See docs/design/new-look/README.md.
 *
 *   node scripts/new-look/shots.mjs capture <dir> [--only a,b] [--themes light,dark] [--base URL] [--width 1440]
 *   node scripts/new-look/shots.mjs compare <beforeDir> <afterDir> [outDir]
 *   node scripts/new-look/shots.mjs compare-image <a.png> <b.png> <out.png>
 *   node scripts/new-look/shots.mjs props <file.json> [--names earlier.json] [--base URL]
 *   node scripts/new-look/shots.mjs props-compare <a.json> <b.json>
 *
 * capture and props start their own Vite dev server on the local backend
 * (Supabase env blanked, so .env is ignored) unless --base points at one,
 * seed it with fixtures/dev-workspace.json, and drive Chromium through
 * Playwright. Every route is saved at 1440 wide (or --width), full page, in
 * both themes; "onboarding" is the first screen of a browser with no
 * workspace, and "dev-ui" is the primitives sheet, whose Interaction states
 * table is 3172 wide (capture it with --width 3172).
 *
 * compare writes a heatmap per changed screen (changed pixels in magenta over
 * the dimmed new screen) and prints the share of pixels that moved. Both
 * compare the overlap of two images of different sizes, from the top left.
 * compare-image does it for any two images: the /dev/ui gate compares the
 * Interaction states table with docs/design/new-look/reference/
 * interaction-states.png, the Figma export (the reference is 4532 tall, so
 * the overlap is the table).
 * props snapshots every custom property at the root in both themes, so a
 * refactor can prove it changed no value.
 *
 * Needs `npx playwright install chromium` once. Set CHROMIUM_PATH to use a
 * Chromium that is already installed. */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const fixture = JSON.parse(await readFile(path.join(here, "fixtures/dev-workspace.json"), "utf8"));
const devDb = fixture.localStorage["brand-portal-dev-db"];
const firstTemplate = devDb.templates[0].id;
// The fixture's Generate threads: a finished result, then a question.
const resultThread = devDb.generateThreads[0].id;
const questionThread = devDb.generateThreads[2].id;
// The saved template chat (new look, Phase 4): its template and its draft.
const templateChat = devDb.generateThreads.find((t) => t.templateId);
const chatTemplate = templateChat.templateId;
const chatDraft = templateChat.turns.at(-1).drafts[0].id;

const ROUTES = [
  ["brand-templates", "/templates"],
  ["brand-templates-platform", "/templates?platform=instagram"],
  ["brand-templates-search", "/templates?q=launch"],
  ["template-fill", `/templates/${firstTemplate}`],
  ["template-chat", `/templates/${chatTemplate}/chat`],
  ["template-chat-result", `/templates/${chatTemplate}/chat/${templateChat.id}`],
  [
    "template-chat-edit",
    `/templates/${chatTemplate}/chat/${templateChat.id}?edit=${encodeURIComponent(chatDraft)}`,
  ],
  ["generate", "/generate"],
  ["generate-history", "/generate/history"],
  ["generate-thread", `/generate/c/${resultThread}`],
  ["generate-thread-question", `/generate/c/${questionThread}`],
  ["template-builder", "/template-builder"],
  ["insights", "/insights"],
  ["brand-studio", "/brand-studio"],
  ["bs-colors", "/brand-studio/colors"],
  ["bs-logos", "/brand-studio/logos"],
  ["bs-fonts", "/brand-studio/typography"],
  ["bs-type-styles", "/brand-studio/type-styles"],
  ["bs-images", "/brand-studio/images"],
  ["bs-import", "/brand-studio/import"],
  // People lives in Settings; /people redirects there (new look, Phase 3).
  ["people-redirect", "/people"],
  ["settings-workspace", "/settings/workspace"],
  ["settings-people", "/settings/people"],
  ["settings-integrations", "/settings/integrations"],
  ["settings-usage", "/settings/usage"],
  ["settings-sharing", "/settings/sharing"],
  ["settings-account", "/settings/account"],
  ["settings-advanced", "/settings/advanced"],
  ["onboarding", "/templates", { fresh: true }],
  ["dev-ui", "/dev/ui"],
];

// ---------------------------------------------------------------- args
const [mode, ...rest] = process.argv.slice(2);
const flags = {};
const positional = [];
const BOOLEAN_FLAGS = new Set(["all"]);
for (let i = 0; i < rest.length; i++) {
  const name = rest[i].startsWith("--") ? rest[i].slice(2) : null;
  if (name && BOOLEAN_FLAGS.has(name)) flags[name] = true;
  else if (name) flags[name] = rest[++i];
  else positional.push(rest[i]);
}
const usage = () => {
  console.error("Usage: see the header of scripts/new-look/shots.mjs");
  process.exit(2);
};

// ---------------------------------------------------------------- server
async function withServer(fn) {
  if (flags.base) return fn(flags.base.replace(/\/$/, ""));
  const port = Number(flags.port ?? 4317);
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

const launch = () =>
  chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});

async function newContext(browser, theme, { fresh = false } = {}) {
  const width = Number(flags.width ?? 1440);
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const seed = fresh ? {} : fixture.localStorage;
  const entries = Object.entries(seed).map(([k, v]) => [
    k,
    typeof v === "string" ? v : JSON.stringify(v),
  ]);
  await context.addInitScript(
    ({ entries, theme }) => {
      try {
        if (sessionStorage.getItem("shots-seeded")) return;
        sessionStorage.setItem("shots-seeded", "1");
        for (const [k, v] of entries) localStorage.setItem(k, v);
        localStorage.setItem("sp-color-scheme", theme);
      } catch {
        /* a frame without storage */
      }
    },
    { entries, theme },
  );
  return context;
}

async function settle(page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1200);
  await page.evaluate(async () => {
    // The dev backend banner (and its dev role switch) never shows in a
    // capture: by its attribute, or by its text in a build without it.
    for (const el of document.querySelectorAll("[data-dev-banner]")) el.style.display = "none";
    for (const el of document.querySelectorAll("[role=status]")) {
      if ((el.textContent ?? "").startsWith("Dev backend")) el.style.display = "none";
    }
    await document.fonts.ready;
  });
}

// ---------------------------------------------------------------- capture
async function capture(dir) {
  const only = flags.only ? flags.only.split(",") : null;
  const themes = (flags.themes ?? "light,dark").split(",");
  await mkdir(dir, { recursive: true });
  await withServer(async (base) => {
    const browser = await launch();
    for (const theme of themes) {
      for (const [name, route, opts] of ROUTES) {
        if (only && !only.includes(name)) continue;
        const context = await newContext(browser, theme, opts);
        const page = await context.newPage();
        await page.goto(base + route, { waitUntil: "domcontentloaded" });
        await settle(page);
        const file = path.join(dir, `${name}-${theme}.png`);
        await page.screenshot({
          path: file,
          fullPage: true,
          animations: "disabled",
          caret: "hide",
        });
        console.log(`${name}-${theme}  ${new URL(page.url()).pathname}`);
        await context.close();
      }
    }
    await browser.close();
  });
}

// ---------------------------------------------------------------- compare
async function compare(beforeDir, afterDir, outDir = path.join(afterDir, "diff")) {
  const before = new Set((await readdir(beforeDir)).filter((f) => f.endsWith(".png")));
  const after = (await readdir(afterDir)).filter((f) => f.endsWith(".png"));
  await mkdir(outDir, { recursive: true });
  const browser = await launch();
  const page = await browser.newPage();
  // Serve both folders on one origin so the canvas can read the pixels.
  await page.route("http://shots.local/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/") return route.fulfill({ contentType: "text/html", body: "<body>" });
    const [, side, file] = url.pathname.split("/");
    const dir = side === "a" ? beforeDir : afterDir;
    return route.fulfill({
      contentType: "image/png",
      body: await readFile(path.join(dir, decodeURIComponent(file))),
    });
  });
  await page.goto("http://shots.local/");
  const rows = [];
  for (const file of after) {
    if (!before.has(file)) {
      rows.push({ file, changed: "new screen" });
      continue;
    }
    const result = await page.evaluate(async (file) => {
      const load = (src) =>
        new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = src;
        });
      const [a, b] = await Promise.all([load(`/a/${file}`), load(`/b/${file}`)]);
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
        if (d > 6) {
          changed++;
          pb[i] = 255;
          pb[i + 1] = 0;
          pb[i + 2] = 200;
        } else {
          pb[i] = pb[i] * 0.5;
          pb[i + 1] = pb[i + 1] * 0.5;
          pb[i + 2] = pb[i + 2] * 0.5;
        }
      }
      document.body.innerHTML = "";
      document.body.style.margin = "0";
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      c.getContext("2d").putImageData(out, 0, 0);
      document.body.appendChild(c);
      return {
        changed,
        total: w * h,
        sizeChanged: a.width !== b.width || a.height !== b.height,
        sizes: [`${a.width}x${a.height}`, `${b.width}x${b.height}`],
      };
    }, file);
    const pct = (100 * result.changed) / result.total;
    if (result.changed > 0) {
      await page.locator("canvas").screenshot({ path: path.join(outDir, file) });
    }
    rows.push({
      file,
      changed: `${pct.toFixed(2)}%`,
      size: result.sizeChanged ? `${result.sizes[0]} -> ${result.sizes[1]}` : "",
    });
  }
  await browser.close();
  for (const f of before) if (!after.includes(f)) rows.push({ file: f, changed: "missing" });
  rows.sort(
    (x, y) => parseFloat(y.changed) - parseFloat(x.changed) || x.file.localeCompare(y.file),
  );
  console.table(rows);
  await writeFile(path.join(outDir, "report.json"), JSON.stringify(rows, null, 2));
}

// ---------------------------------------------------------- compare-image
async function compareImage(a, b, out) {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "shots-"));
  const name = path.basename(out);
  await mkdir(path.join(tmp, "a"));
  await mkdir(path.join(tmp, "b"));
  await copyFile(a, path.join(tmp, "a", name));
  await copyFile(b, path.join(tmp, "b", name));
  await compare(path.join(tmp, "a"), path.join(tmp, "b"), path.join(tmp, "diff"));
  const heatmap = path.join(tmp, "diff", name);
  if (existsSync(heatmap)) {
    await mkdir(path.dirname(out), { recursive: true });
    await copyFile(heatmap, out);
    console.log(`heatmap -> ${out}`);
  }
}

// ---------------------------------------------------------------- props
async function stylesheetNames() {
  const dir = path.join(root, "src/styles");
  const names = new Set();
  for (const f of await readdir(dir)) {
    if (!f.endsWith(".css")) continue;
    const text = await readFile(path.join(dir, f), "utf8");
    for (const m of text.matchAll(/(--[\w-]+)\s*:/g)) names.add(m[1]);
  }
  return names;
}

async function props(file) {
  const names = await stylesheetNames();
  if (flags.names && existsSync(flags.names)) {
    const earlier = JSON.parse(await readFile(flags.names, "utf8"));
    for (const n of Object.keys(earlier.light ?? {})) names.add(n);
  }
  const list = [...names].sort();
  const snapshot = {};
  await withServer(async (base) => {
    const browser = await launch();
    for (const theme of ["light", "dark"]) {
      const context = await newContext(browser, theme);
      const page = await context.newPage();
      await page.goto(base + "/templates", { waitUntil: "domcontentloaded" });
      await settle(page);
      snapshot[theme] = await page.evaluate((list) => {
        const cs = getComputedStyle(document.documentElement);
        return Object.fromEntries(list.map((n) => [n, cs.getPropertyValue(n).trim()]));
      }, list);
      await context.close();
    }
    await browser.close();
  });
  await writeFile(file, JSON.stringify(snapshot, null, 1));
  console.log(`${list.length} custom properties x 2 themes -> ${file}`);
}

const normalize = (v = "") =>
  v
    .replace(/\s+/g, " ")
    .replace(
      /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/g,
      (_, r, g, b, a) => `rgb(${r} ${g} ${b}${a === undefined ? "" : ` / ${Number(a)}`})`,
    )
    .trim();

// Prints values that changed and names that lost their value. Names that only
// gained one (new tokens) are counted, and listed with --all. Exits 1 when
// anything changed or was lost.
async function propsCompare(fileA, fileB) {
  const a = JSON.parse(await readFile(fileA, "utf8"));
  const b = JSON.parse(await readFile(fileB, "utf8"));
  let total = 0;
  for (const theme of ["light", "dark"]) {
    const names = new Set([...Object.keys(a[theme] ?? {}), ...Object.keys(b[theme] ?? {})]);
    const changed = [];
    const added = [];
    for (const n of [...names].sort()) {
      const x = normalize(a[theme]?.[n]);
      const y = normalize(b[theme]?.[n]);
      if (x === y) continue;
      if (!x) added.push({ property: n, after: y });
      else changed.push({ property: n, before: x, after: y || "(unset)" });
    }
    total += changed.length;
    console.log(`\n${theme}: ${changed.length} changed or lost, ${added.length} new`);
    if (changed.length) console.table(changed);
    if (added.length && "all" in flags) console.table(added);
  }
  process.exitCode = total ? 1 : 0;
}

// ---------------------------------------------------------------- main
if (mode === "capture" && positional[0]) await capture(positional[0]);
else if (mode === "compare" && positional[1]) await compare(...positional);
else if (mode === "compare-image" && positional[2]) await compareImage(...positional);
else if (mode === "props" && positional[0]) await props(positional[0]);
else if (mode === "props-compare" && positional[1]) await propsCompare(...positional);
else usage();
