#!/usr/bin/env node
/**
 * Import intent eval (docs/import-intent/PHASE-1.md, Step 6).
 *
 *   npx vite-node scripts/import-intent/eval.mjs [options]
 *
 *   --trees <file>  A saved /v1/files/:key/nodes response holding keyed
 *                   frames. Default: import-intent.local/corpus/all-frames.json
 *                   when that file exists.
 *   --file <key>    The Figma file those frames come from, so --model can
 *                   fetch each frame's picture (FIGMA_TOKEN). Without it the
 *                   model reads the element list alone.
 *   --model         Also run the model pass (ANTHROPIC_API_KEY). It spends
 *                   money: the script says how many calls before it starts.
 *   --only <text>   Only frames whose name contains this.
 *   --list          Print what each frame lands as and stop. Use it to
 *                   write expectations.json.
 *   --out <file>    Where the full report goes.
 *                   Default: import-intent.local/eval-report.json
 *
 * It runs the import both Figma functions run (importFrame, then the model
 * pass template-autobuild makes) over saved node trees, and counts the edits
 * an admin still has to make before publishing.
 *
 * A keyed frame is scored twice: as its designer keyed it, and with every
 * layer renamed to what Figma would have called it. The answers are the
 * frame's own keys (what each layer says `edit` is), so on the renamed copy
 * the model's guesses are scored against answers it was never shown. Frames
 * with no keys are scored against scripts/import-intent/expectations.json,
 * written by hand.
 *
 * An edit is: Fixed the wrong way round on a field, a member field still
 * carrying its layer's default name, or a caption to write. Character
 * limits aren't scored here. The browser measures them on every route, and
 * this runs without one. No brand kit is given, so type styles and the
 * palette aren't exercised either.
 *
 * It runs through vite-node because the importer's modules use TypeScript
 * that Node's type stripping doesn't take.
 *
 * The corpus is a client's file: it and the report stay under
 * import-intent.local/, which git ignores. FIGMA_TOKEN and ANTHROPIC_API_KEY
 * come from the environment, or from .env.local when the environment has
 * none. They are never printed, committed or used in CI.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { importFrame } from "../../supabase/functions/_shared/importFrame.ts";
import {
  applyIntentProposal,
  intentAsk,
  intentRequest,
  intentUserText,
  readIntentAnswer,
  tokensOf,
} from "../../supabase/functions/_shared/importIntent.ts";
import {
  AUTOBUILD_DEFAULT_MODEL,
  AUTOBUILD_SYSTEM_PROMPT,
} from "../../supabase/functions/template-autobuild/prompt.ts";
import {
  editsBefore,
  renameToDefaults,
  scoreRoute,
  truthFromKeys,
  truthFromList,
} from "../../src/app/dev/importEval.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const localDir = path.join(root, "import-intent.local");

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const name = arg.slice(2);
    if (name === "model" || name === "list") flags[name] = true;
    else flags[name] = argv[++i];
  }
  return flags;
}

const flags = parseArgs(process.argv.slice(2));
const defaultTrees = path.join(localDir, "corpus/all-frames.json");
const treesFile = flags.trees
  ? path.resolve(flags.trees)
  : existsSync(defaultTrees)
    ? defaultTrees
    : null;
const outFile = path.resolve(flags.out ?? path.join(localDir, "eval-report.json"));

/** A value from the environment, or from .env.local here or in the main
 * checkout (a worktree has none of its own). Never printed. */
function secret(name) {
  if (process.env[name]) return process.env[name];
  const files = [path.join(root, ".env.local")];
  try {
    const common = execFileSync(
      "git",
      ["rev-parse", "--path-format=absolute", "--git-common-dir"],
      { cwd: root, encoding: "utf8" },
    ).trim();
    files.push(path.join(path.dirname(common), ".env.local"));
  } catch {
    // Not a git checkout: the first file is the only place to look.
  }
  const line = new RegExp(`^\\s*${name}\\s*=\\s*(.*?)\\s*$`);
  for (const file of files) {
    if (!existsSync(file)) continue;
    for (const text of readFileSync(file, "utf8").split("\n")) {
      const value = line.exec(text)?.[1]?.replace(/^["']|["']$/g, "");
      if (value) return value;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Frames
// ---------------------------------------------------------------------------

async function loadFrames() {
  const frames = [];
  if (treesFile) {
    const body = JSON.parse(await readFile(treesFile, "utf8"));
    for (const [nodeId, entry] of Object.entries(body.nodes ?? {})) {
      const tree = entry?.document;
      if (!tree?.absoluteBoundingBox) continue;
      frames.push({ source: "corpus", nodeId, name: tree.name, tree });
    }
  }
  const expectations = JSON.parse(await readFile(path.join(here, "expectations.json"), "utf8"));
  for (const e of expectations.frames) {
    const dir = path.join(root, "test/fidelity/fixtures", e.fixture);
    const body = JSON.parse(await readFile(path.join(dir, "figma-node.json"), "utf8"));
    const tree = body.nodes?.[e.nodeId]?.document;
    if (!tree?.absoluteBoundingBox) {
      throw new Error(`expectations.json: ${e.fixture} has no node ${e.nodeId}`);
    }
    frames.push({
      source: "repo",
      nodeId: e.nodeId,
      name: tree.name,
      tree,
      members: e.members,
      pictureFile: path.join(dir, "golden.png"),
    });
  }
  const only = flags.only?.toLowerCase();
  return only ? frames.filter((f) => f.name.toLowerCase().includes(only)) : frames;
}

const cachedPicture = (nodeId) =>
  path.join(localDir, "renders", `${nodeId.replace(/[^0-9a-z]/gi, "-")}.png`);

/** Each corpus frame's picture at scale 1, as the function fetches it,
 * kept beside the corpus so a second run asks Figma for nothing. */
async function fetchPictures(frames) {
  const wanted = frames.filter(
    (f) => f.source === "corpus" && !existsSync(cachedPicture(f.nodeId)),
  );
  if (!wanted.length) return;
  const token = secret("FIGMA_TOKEN");
  if (!flags.file || !token) {
    console.log(
      `No picture for ${wanted.length} frame${wanted.length === 1 ? "" : "s"}: pass --file <key> with FIGMA_TOKEN set. The model will read the element list alone.`,
    );
    return;
  }
  await mkdir(path.join(localDir, "renders"), { recursive: true });
  for (let i = 0; i < wanted.length; i += 25) {
    const batch = wanted.slice(i, i + 25);
    const ids = encodeURIComponent(batch.map((f) => f.nodeId).join(","));
    const res = await fetch(
      `https://api.figma.com/v1/images/${flags.file}?ids=${ids}&format=png&scale=1`,
      { headers: { "X-Figma-Token": token } },
    );
    if (!res.ok) {
      console.log(`Figma refused the pictures (${res.status}). Continuing without them.`);
      return;
    }
    const { images } = await res.json();
    for (const frame of batch) {
      const url = images?.[frame.nodeId];
      const png = url ? await fetch(url) : null;
      if (png?.ok) {
        await writeFile(cachedPicture(frame.nodeId), Buffer.from(await png.arrayBuffer()));
      }
    }
  }
}

async function pictureOf(frame) {
  const file = frame.pictureFile ?? cachedPicture(frame.nodeId);
  return existsSync(file) ? (await readFile(file)).toString("base64") : null;
}

// ---------------------------------------------------------------------------
// The model pass, as template-autobuild makes it
// ---------------------------------------------------------------------------

const NO_KIT = { typeStyles: [], colors: [], catalog: [] };
const NO_COST = { calls: 0, inputTokens: 0, outputTokens: 0, modelMs: 0 };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** One forced tool call over an import's fields, applied in place. Returns
 * what the pass decided, or why it decided nothing: either way the fields
 * are what that import would land as. */
async function modelPass(model, apiKey, tree, imported, imageBase64) {
  const ask = intentAsk(imported.fields, imported.intents);
  if (!ask.elements.length) return { cost: NO_COST, failed: "nothing to ask about" };
  const box = tree.absoluteBoundingBox;
  const request = JSON.stringify(
    intentRequest({
      model,
      system: AUTOBUILD_SYSTEM_PROMPT,
      mode: "template",
      imageBase64,
      userText: intentUserText({
        mode: "template",
        frameName: tree.name,
        canvasWidth: Math.round(box.width),
        canvasHeight: Math.round(box.height),
        elements: ask.elements,
        brand: NO_KIT,
      }),
    }),
  );
  const started = Date.now();
  let res;
  for (let attempt = 1; ; attempt += 1) {
    try {
      res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal: AbortSignal.timeout(120_000),
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: request,
      });
    } catch (e) {
      return {
        cost: { ...NO_COST, modelMs: Date.now() - started },
        failed: `no response (${e instanceof Error ? e.name : "error"})`,
      };
    }
    // Rate limits and overload aren't the import's doing: wait and ask again.
    const retryable = res.status === 429 || res.status === 529 || res.status >= 500;
    if (!retryable || attempt === 3) break;
    await sleep(1000 * (Number(res.headers.get("retry-after")) || 5 * attempt));
  }
  const modelMs = Date.now() - started;
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 200);
    return { cost: { ...NO_COST, modelMs }, failed: `HTTP ${res.status} ${detail}` };
  }
  const answer = readIntentAnswer(await res.json());
  const cost = { calls: 1, ...tokensOf(answer.usage), modelMs };
  if (answer.input === undefined) {
    return { cost, failed: `no usable answer (${answer.stopReason ?? "no tool call"})` };
  }
  try {
    const outcome = applyIntentProposal(answer.input, {
      mode: "template",
      fields: imported.fields,
      intents: imported.intents,
      ask,
      brand: NO_KIT,
    });
    return { cost, outcome, skipped: ask.skipped };
  } catch (e) {
    return { cost, failed: e instanceof Error ? e.message : "the answer couldn't be applied" };
  }
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

const fieldRows = (fields, truth) => {
  const want = new Map(truth.map((t) => [t.sourceNodeId, t.member]));
  return fields.map((f) => ({
    layer: f.sourceNodeId,
    type: f.type,
    label: f.label,
    landed: f.static ? "fixed" : "member",
    ...(want.has(f.sourceNodeId)
      ? { expected: want.get(f.sourceNodeId) ? "member" : "fixed" }
      : {}),
  }));
};

/** One variant of a frame through both routes. */
async function runVariant(frame, tree, truth, labelsAreDefault, model, apiKey) {
  const landed = importFrame(tree);
  const defaultLabels = labelsAreDefault
    ? new Map(landed.fields.map((f) => [f.sourceNodeId, f.label]))
    : undefined;
  const out = {
    keys: {
      score: scoreRoute({ truth, fields: landed.fields, defaultLabels }),
      fields: fieldRows(landed.fields, truth),
    },
  };
  if (apiKey) {
    const again = importFrame(tree);
    const pass = await modelPass(model, apiKey, tree, again, await pictureOf(frame));
    out.model = {
      score: scoreRoute({
        truth,
        fields: again.fields,
        defaultLabels,
        caption: pass.outcome?.template?.captionTemplate,
      }),
      fields: fieldRows(again.fields, truth),
      cost: pass.cost,
      ...(pass.outcome?.template ? { template: pass.outcome.template } : {}),
      ...(pass.failed ? { failed: pass.failed } : {}),
      ...(pass.skipped ? { skipped: pass.skipped } : {}),
    };
  }
  return out;
}

async function evalFrame(frame, model, apiKey) {
  const asDrawn = importFrame(frame.tree);
  const base = { name: frame.name, source: frame.source, fields: asDrawn.fields.length };
  if (frame.source === "repo") {
    const { truth, unknown } = truthFromList(asDrawn.fields, frame.members);
    if (unknown.length) {
      throw new Error(
        `expectations.json: ${frame.name} lists layers the import doesn't land as text or an image: ${unknown.join(", ")}`,
      );
    }
    return {
      ...base,
      members: truth.filter((t) => t.member).length,
      before: editsBefore(truth),
      unkeyed: await runVariant(frame, frame.tree, truth, true, model, apiKey),
    };
  }
  const truth = truthFromKeys(asDrawn.fields, asDrawn.intents);
  if (!truth.length) return { ...base, skipped: "no layer states edit, so there is no answer" };
  return {
    ...base,
    keyedLayers: `${asDrawn.parse.keyed} of ${asDrawn.parse.layers}`,
    members: truth.filter((t) => t.member).length,
    before: editsBefore(truth),
    keyed: await runVariant(frame, frame.tree, truth, false, model, apiKey),
    unkeyed: await runVariant(frame, renameToDefaults(frame.tree), truth, true, model, apiKey),
  };
}

/** Run `fn` over items, a few at a time, keeping their order. */
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

function printTable(rows) {
  const widths = rows[0].map((_, col) => Math.max(...rows.map((r) => String(r[col]).length)));
  for (const [i, row] of rows.entries()) {
    console.log(
      row.map((cell, col) => String(cell)[col ? "padStart" : "padEnd"](widths[col])).join("  "),
    );
    if (i === 0) console.log(widths.map((w) => "-".repeat(w)).join("  "));
  }
}

const total = (score) => (score ? score.total : "");
const sum = (values) => values.reduce((n, v) => n + (typeof v === "number" ? v : 0), 0);

function report(results, withModel) {
  const scored = results.filter((r) => !r.skipped);
  const header = [
    "Frame",
    "Fields",
    "Members",
    "Before",
    "Keyed",
    ...(withModel ? ["Keyed + model"] : []),
    "Unkeyed",
    ...(withModel ? ["Unkeyed + model", "Calls", "Tokens in", "Tokens out", "Seconds"] : []),
  ];
  const cost = (r, key) =>
    sum(
      [r.keyed?.model?.cost?.[key], r.unkeyed?.model?.cost?.[key]].filter((v) => v !== undefined),
    );
  const rows = scored.map((r) => [
    r.name.slice(0, 44),
    r.fields,
    r.members,
    r.before,
    r.keyed ? total(r.keyed.keys.score) : "-",
    ...(withModel ? [r.keyed ? total(r.keyed.model?.score) : "-"] : []),
    total(r.unkeyed.keys.score),
    ...(withModel
      ? [
          total(r.unkeyed.model?.score),
          cost(r, "calls"),
          cost(r, "inputTokens"),
          cost(r, "outputTokens"),
          (cost(r, "modelMs") / 1000).toFixed(1),
        ]
      : []),
  ]);
  const column = (i) => sum(rows.map((row) => row[i]));
  const totals = header.map((name, i) => {
    if (i === 0) return `Total, ${scored.length} frames`;
    if (name === "Seconds") return sum(rows.map((row) => Number(row[i]))).toFixed(1);
    return column(i);
  });
  console.log("\nEdits before publish, by frame. Fewer is better.\n");
  printTable([header, ...rows, totals]);

  if (withModel) {
    const calls = totals[header.indexOf("Calls")];
    if (calls) {
      const per = (name) => Math.round(totals[header.indexOf(name)] / calls);
      const seconds = (Number(totals[header.indexOf("Seconds")]) / calls).toFixed(1);
      console.log(
        `\nPer import: 1 call, ${per("Tokens in")} tokens in, ${per("Tokens out")} out, ${seconds} seconds added.`,
      );
    }
    const failures = scored.flatMap((r) =>
      ["keyed", "unkeyed"].flatMap((v) =>
        r[v]?.model?.failed ? [`${r.name} (${v}): ${r[v].model.failed}`] : [],
      ),
    );
    if (failures.length) {
      console.log(`\nThe model pass failed on ${failures.length}, which landed on their keys:`);
      for (const line of failures) console.log(`  ${line}`);
    }
  }
  for (const r of results.filter((x) => x.skipped)) {
    console.log(`Skipped ${r.name}: ${r.skipped}.`);
  }
}

// ---------------------------------------------------------------------------

async function main() {
  const frames = await loadFrames();
  if (!frames.length) {
    console.error("No frames to run. Pass --trees <file>, or check --only.");
    process.exit(2);
  }

  if (flags.list) {
    for (const frame of frames) {
      console.log(`\n${frame.name}  (${frame.nodeId})`);
      const landed = importFrame(frame.tree);
      printTable([
        ["Layer", "Type", "Lands", "Label"],
        ...landed.fields.map((f) => [
          f.sourceNodeId,
          f.type,
          f.static ? "fixed" : "member",
          f.label.slice(0, 60),
        ]),
      ]);
    }
    return;
  }

  const apiKey = flags.model ? secret("ANTHROPIC_API_KEY") : undefined;
  const model = process.env.ANTHROPIC_MODEL ?? AUTOBUILD_DEFAULT_MODEL;
  if (flags.model && !apiKey) {
    console.log(
      "ANTHROPIC_API_KEY is not set (environment or .env.local), so the model pass is skipped. The rest runs offline.",
    );
  }
  if (apiKey) {
    const calls = frames.reduce((n, f) => n + (f.source === "repo" ? 1 : 2), 0);
    console.log(`Up to ${calls} calls to ${model}, one per frame and variant.`);
    await fetchPictures(frames);
  }

  const results = await mapLimit(frames, apiKey ? 3 : 8, (frame) =>
    evalFrame(frame, model, apiKey),
  );
  report(results, Boolean(apiKey));

  await mkdir(path.dirname(outFile), { recursive: true });
  await writeFile(
    outFile,
    JSON.stringify(
      { ranAt: new Date().toISOString(), model: apiKey ? model : null, frames: results },
      null,
      2,
    ),
  );
  console.log(`\nFull report: ${path.relative(root, outFile)}`);
}

await main();
