#!/usr/bin/env node
/* Screenshot loop for the new look. See docs/design/new-look/README.md.
 *
 *   node scripts/new-look/shots.mjs capture <dir> [--only a,b] [--themes light,dark] [--widths 1440,1024,390] [--no-popups] [--collapsed] [--base URL]
 *   node scripts/new-look/shots.mjs compare <beforeDir> <afterDir> [outDir]
 *   node scripts/new-look/shots.mjs compare-image <a.png> <b.png> <out.png>
 *   node scripts/new-look/shots.mjs boards <dir> [--base URL]
 *   node scripts/new-look/shots.mjs props <file.json> [--names earlier.json] [--base URL]
 *   node scripts/new-look/shots.mjs props-compare <a.json> <b.json>
 *
 * capture and props start their own Vite dev server on the local backend
 * (Supabase env blanked, so .env is ignored) unless --base points at one,
 * seed it with fixtures/dev-workspace.json (its clock pinned), and drive Chromium through
 * Playwright. Every route is saved full page at 1440, 1024 and 390 wide (or
 * --widths) in both themes, as <name>-<theme>-<width>.png (PHASE-9 §9 D9).
 * "onboarding" is the first screen of a browser with no workspace, and
 * "dev-ui" is the primitives sheet: the boards of the Components page, each
 * 1600 wide, then the working sheet.
 *
 * A route's options hold a page in a state: `stall` freezes local store
 * calls in loading ("hang") or error ("fail") through src/lib/stores/local/
 * devStall.ts, `seed` edits the fixture's database first (the empty states),
 * `publicLink` answers the public page's Edge Function (a payload built from
 * the fixture, or a 404 for the unavailable state), `widths` limits the
 * route, and `act` opens a dialog before the shot. At the widest width each
 * route also opens every menu, select and popover trigger it renders
 * ([aria-haspopup]) one at a time and saves <name>--popup-<n>-<theme>-<width>.png
 * (skip with --no-popups).
 *
 * At 1024 and wider the app frame scrolls Main's content, not the document,
 * so before each shot the window grows by the height that content hides and
 * the shot holds the whole page, the way a tall window shows it. A page that
 * scrolls itself (the Generate thread, History, the builder) keeps the
 * window's height. --collapsed starts every route with the sidebar
 * collapsed.
 *
 * compare writes a heatmap per changed screen (changed pixels in magenta over
 * the dimmed new screen) and prints the share of pixels that moved. Both
 * compare the overlap of two images of different sizes, from the top left.
 * compare-image does it for any two images. boards saves each board of
 * /dev/ui as its own image, <board>.png, so the /dev/ui gate can compare
 * every board with its Figma export in docs/design/new-brand/reference/
 * (buttons, fields, selection, labels, avatars, navigation, containers and
 * themes).
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
  // The sign-in gate, rendered without Supabase (PHASE-8B §9 D8).
  ["auth-sign-in", "/dev/auth"],
  [
    "auth-sign-in-error",
    `/dev/auth?error=${encodeURIComponent("That email and password don’t match.")}`,
  ],
  ["auth-sign-up", "/dev/auth?view=signup"],
  [
    "auth-sign-up-error",
    `/dev/auth?view=signup&error=${encodeURIComponent("Use at least 8 characters.")}`,
  ],
  ["auth-reset", "/dev/auth?view=forgot"],
  ["auth-reset-sent", "/dev/auth?view=resetSent"],
  ["auth-check-email", "/dev/auth?view=checkEmail"],
  ["auth-new-password", "/dev/auth?view=setPassword"],
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
  // Loading, empty and error (PHASE-9 §9 D9): the stores held, or the
  // fixture emptied.
  ["brand-templates-loading", "/templates", { stall: { "templates.*": "hang" } }],
  ["brand-templates-error", "/templates", { stall: { "templates.*": "fail" } }],
  ["brand-templates-empty", "/templates", { seed: (db) => (db.templates = []) }],
  ["template-fill-error", `/templates/${firstTemplate}`, { stall: { "templates.*": "fail" } }],
  ["generate-history-loading", "/generate/history", { stall: { "generateThreads.*": "hang" } }],
  ["generate-history-error", "/generate/history", { stall: { "generateThreads.*": "fail" } }],
  ["generate-history-empty", "/generate/history", { seed: (db) => (db.generateThreads = []) }],
  ["insights-loading", "/insights", { stall: { "usage.*": "hang" } }],
  ["insights-error", "/insights", { stall: { "usage.*": "fail" } }],
  ["insights-empty", "/insights", { seed: (db) => (db.usageEvents = []) }],
  ["brand-studio-loading", "/brand-studio", { stall: { "brandAssets.*": "hang" } }],
  ["settings-people-loading", "/settings/people", { stall: { "people.*": "hang" } }],
  ["settings-people-error", "/settings/people", { stall: { "people.*": "fail" } }],
  ["settings-usage-loading", "/settings/usage", { stall: { "usage.*": "hang" } }],
  ["settings-usage-error", "/settings/usage", { stall: { "usage.*": "fail" } }],
  ["settings-sharing-error", "/settings/sharing", { stall: { "publicLinks.*": "fail" } }],
  // The surfaces with no frames, which still render here (PHASE-9 §4.1).
  ["template-builder-loading", "/template-builder", { stall: { "templates.*": "hang" } }],
  ["template-builder-error", "/template-builder", { stall: { "templates.*": "fail" } }],
  ["template-builder-empty", "/template-builder", { seed: (db) => (db.templates = []) }],
  [
    "template-builder-delete",
    "/template-builder",
    { act: (page) => page.locator("button[title=Delete]").first().click() },
  ],
  ["builder-editor", `/template-builder/${firstTemplate}`],
  ["builder-picker", "/template-builder/new"],
  [
    "builder-size-gallery",
    "/template-builder/new",
    {
      act: (page) =>
        page
          .getByRole("button", { name: /^Start blank/ })
          .first()
          .click(),
    },
  ],
  ["bulk-fill", `/templates/${firstTemplate}/bulk`],
  ["bulk-fill-error", `/templates/${firstTemplate}/bulk`, { stall: { "templates.*": "fail" } }],
  ["public-link", "/l/shots-link", { publicLink: "template" }],
  ["public-link-unavailable", "/l/shots-missing", { publicLink: "missing" }],
  // The narrow layout's navigation drawer.
  [
    "nav-drawer",
    "/templates",
    {
      widths: [390],
      act: (page) => page.getByRole("button", { name: "Open navigation" }).click(),
    },
  ],
  ["onboarding", "/templates", { fresh: true }],
  // Onboarding's steps on stand-in services (PHASE-8B §9 D8).
  ["onboarding-01-about-you", "/dev/onboarding?step=about"],
  ["onboarding-02-set-up-for", "/dev/onboarding?step=setupFor"],
  ["onboarding-03-your-team", "/dev/onboarding?step=team"],
  ["onboarding-04-first-up", "/dev/onboarding?step=firstUp"],
  ["onboarding-05-website", "/dev/onboarding?step=website"],
  ["onboarding-05b-add-your-brand", "/dev/onboarding?step=addBrand"],
  ["onboarding-06-pulling", "/dev/onboarding?step=pulling"],
  ["onboarding-07-your-brand", "/dev/onboarding?step=brand"],
  ["onboarding-08-invite", "/dev/onboarding?step=invite"],
  ["onboarding-09-ready", "/dev/onboarding?step=ready"],
  ["dev-ui", "/dev/ui"],
];

// ---------------------------------------------------------------- args
const [mode, ...rest] = process.argv.slice(2);
const flags = {};
const positional = [];
const BOOLEAN_FLAGS = new Set(["all", "no-popups", "collapsed"]);
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

// The public page's Edge Function answer: the fixture's first template and
// kit as the database rows the function returns, as one look (a link pinned
// to a colourway).
const snake = (o) =>
  Object.fromEntries(
    Object.entries(o).map(([k, v]) => [k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`), v]),
  );
function publicPayload() {
  const { fields, ...template } = devDb.templates[0];
  return {
    template: {
      ...snake(template),
      background_storage_path: null,
      variants: null,
      template_fields: fields.map((f, i) => ({ ...snake(f), sort_order: i })),
    },
    brandKit: snake(devDb.brandKits[0]),
    fontAssets: [],
    allowUploads: true,
    assetTtlSeconds: 300,
  };
}

async function newContext(
  browser,
  theme,
  { fresh = false, stall, seed: edit, publicLink } = {},
  width = 1440,
) {
  const context = await browser.newContext({
    viewport: { width, height: width < 768 ? 844 : 900 },
  });
  if (publicLink) {
    await context.route("**/functions/v1/**", (route) =>
      publicLink === "template" && route.request().url().endsWith("/public-template")
        ? route.fulfill({ contentType: "application/json", body: JSON.stringify(publicPayload()) })
        : route.fulfill({ status: publicLink === "template" ? 204 : 404, body: "" }),
    );
  }
  // The fixture's pinned "now" (seed-insights.mjs): Date stands still at it,
  // timers keep running, so Insights' rolling windows match between runs.
  if (fixture.pinnedClock) await context.clock.setFixedTime(new Date(fixture.pinnedClock));
  let seed = fresh ? {} : fixture.localStorage;
  if (edit) {
    const db = structuredClone(devDb);
    edit(db);
    seed = { ...seed, "brand-portal-dev-db": db };
  }
  const entries = Object.entries(seed).map(([k, v]) => [
    k,
    typeof v === "string" ? v : JSON.stringify(v),
  ]);
  await context.addInitScript(
    ({ entries, theme, stall, collapsed }) => {
      try {
        if (stall) sessionStorage.setItem("sp-dev-stall", JSON.stringify(stall));
        if (sessionStorage.getItem("shots-seeded")) return;
        sessionStorage.setItem("shots-seeded", "1");
        for (const [k, v] of entries) localStorage.setItem(k, v);
        localStorage.setItem("sp-color-scheme", theme);
        // The sidebar's collapsed preference (layout/ChromeContext.tsx).
        if (collapsed) localStorage.setItem("sp-sidebar-collapsed", "1");
      } catch {
        /* a frame without storage */
      }
    },
    { entries, theme, stall: stall ?? null, collapsed: Boolean(flags.collapsed) },
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

/** The app frame (layout/Page.tsx) scrolls Main's content inside the window
 * at 1024 and wider, so a full-page shot would stop at the window's foot.
 * Grow the window by what the content hides, until it hides nothing: the
 * frame then holds the whole page, as a window that tall would. The content
 * carries [data-frame-scroll]; it scrolls only in the frame's "scroll" kind
 * at desktop width, so narrow layouts, pages that scroll themselves and
 * pages outside the frame keep the window as it is. */
async function growToFrame(page) {
  for (let pass = 0; pass < 4; pass++) {
    const hidden = await page.evaluate(() => {
      const el = document.querySelector("[data-frame-scroll]");
      if (!el) return 0;
      const { overflowY } = getComputedStyle(el);
      if (overflowY !== "auto" && overflowY !== "scroll") return 0;
      return Math.max(0, el.scrollHeight - el.clientHeight);
    });
    if (hidden <= 0) return;
    const { width, height } = page.viewportSize();
    await page.setViewportSize({ width, height: height + hidden });
    await page.waitForTimeout(400);
  }
}

// ---------------------------------------------------------------- capture
async function capture(dir) {
  const only = flags.only ? flags.only.split(",") : null;
  const themes = (flags.themes ?? "light,dark").split(",");
  const widths = (flags.widths ?? flags.width ?? "1440,1024,390").split(",").map(Number);
  const popups = !("no-popups" in flags);
  await mkdir(dir, { recursive: true });
  const shoot = (page, file) =>
    page.screenshot({
      path: path.join(dir, file),
      fullPage: true,
      animations: "disabled",
      caret: "hide",
    });
  await withServer(async (base) => {
    const browser = await launch();
    for (const theme of themes) {
      for (const [name, route, opts = {}] of ROUTES) {
        if (only && !only.includes(name)) continue;
        const routeWidths = opts.widths ? widths.filter((w) => opts.widths.includes(w)) : widths;
        for (const width of routeWidths) {
          const context = await newContext(browser, theme, opts, width);
          const page = await context.newPage();
          await page.goto(base + route, { waitUntil: "domcontentloaded" });
          await settle(page);
          if (opts.act) {
            // A layout that doesn't offer the control (the builder below
            // desktop width) keeps its plain shot, with a note.
            page.setDefaultTimeout(5000);
            await opts.act(page).catch(() => console.log(`  ${name}: nothing to open at ${width}`));
            await settle(page);
          }
          await growToFrame(page);
          await shoot(page, `${name}-${theme}-${width}.png`);
          console.log(`${name}-${theme}-${width}  ${new URL(page.url()).pathname}`);
          if (popups && !opts.act && width === Math.max(...widths)) {
            await capturePopups(page, (n) =>
              shoot(page, `${name}--popup-${n}-${theme}-${width}.png`),
            );
          }
          await context.close();
        }
      }
    }
    await browser.close();
  });
}

/** Opens each visible [aria-haspopup] trigger in turn, shoots it open, and
 * closes it with Escape. A trigger that leaves the page (or can't be clicked)
 * is skipped, and the page is reloaded so the next one starts clean. */
async function capturePopups(page, shoot) {
  const url = page.url();
  // The boards of /dev/ui draw each control once per state. Their triggers
  // are pictures of states; the working sheet under them has the live ones.
  const triggers = () => page.locator("[aria-haspopup]:visible:not(.dev-board *)");
  const count = await triggers().count();
  let n = 0;
  for (let i = 0; i < count; i++) {
    const trigger = triggers().nth(i);
    try {
      await trigger.click({ timeout: 2000 });
    } catch {
      continue;
    }
    await page.waitForTimeout(400);
    if (page.url() !== url) {
      await page.goto(url, { waitUntil: "domcontentloaded" });
      await settle(page);
      continue;
    }
    await shoot(++n);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
  }
  if (n) console.log(`  ${n} popups`);
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

// ----------------------------------------------------------------- boards
/** Saves each board of /dev/ui as <board>.png. A board pins its own themes
 * (Light, with a Dark preview under each component), so one pass covers
 * both. */
async function boards(dir) {
  await mkdir(dir, { recursive: true });
  await withServer(async (base) => {
    const browser = await launch();
    const context = await newContext(browser, "light", {}, 1680);
    const page = await context.newPage();
    await page.goto(base + "/dev/ui", { waitUntil: "domcontentloaded" });
    await settle(page);
    for (const board of await page.locator(".dev-board").all()) {
      const name = await board.getAttribute("data-board");
      await board.screenshot({
        path: path.join(dir, `${name}.png`),
        animations: "disabled",
        caret: "hide",
      });
      console.log(name);
    }
    await browser.close();
  });
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
else if (mode === "boards" && positional[0]) await boards(positional[0]);
else if (mode === "props" && positional[0]) await props(positional[0]);
else if (mode === "props-compare" && positional[1]) await propsCompare(...positional);
else usage();
