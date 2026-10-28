#!/usr/bin/env node
/**
 * Goldens for figma fidelity fixtures (docs/brand-system/PHASE-0.md, Step 3).
 *
 *   node scripts/fidelity/goldens.mjs fetch <fixture> [--approved]
 *   node scripts/fidelity/goldens.mjs asset <fixture> <nodeId> <file.png>
 *   node scripts/fidelity/goldens.mjs fill <fixture> <imageRef> <file>
 *
 * fetch exports the fixture's source node at scale 1 through the Figma REST
 * images endpoint as golden.png, and saves the raw node JSON
 * (/v1/files/:key/nodes?ids=…&geometry=paths) as figma-node.json, which
 * Phase 4 replays the importer against offline.
 *
 * asset exports any other node of the same file at scale 1 beside the
 * fixture (a texture or a photo the hand-built schema uses as an image).
 *
 * fill downloads one image fill of the same file by its image ref, as
 * Figma stores it. asset and fill also serve "import" fixtures, whose
 * offline replay needs the renders and fills a live import would fetch.
 *
 * FIGMA_TOKEN comes from the environment, or from .env.local when the
 * environment has none. It is never printed, committed or used in CI.
 * Goldens are CJ's to approve: fetch won't replace an existing golden
 * without --approved.
 */
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as prettier from "prettier";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const fixturesDir = path.join(root, "test/fidelity/fixtures");
const API = "https://api.figma.com/v1";

const usage = () => {
  console.error("Usage: see the header of scripts/fidelity/goldens.mjs");
  process.exit(2);
};

async function token() {
  if (process.env.FIGMA_TOKEN) return process.env.FIGMA_TOKEN;
  const envFile = path.join(root, ".env.local");
  if (existsSync(envFile)) {
    for (const line of (await readFile(envFile, "utf8")).split("\n")) {
      const m = /^\s*FIGMA_TOKEN\s*=\s*(.*)\s*$/.exec(line);
      if (m && m[1]) return m[1].replace(/^["']|["']$/g, "");
    }
  }
  console.error("FIGMA_TOKEN is not set (environment or .env.local).");
  process.exit(2);
}

/** "62-1210" (the URL form) and "62:1210" (the API form) name the same node. */
const apiNodeId = (id) => id.replaceAll("-", ":");

async function figma(pathname, tok) {
  const res = await fetch(`${API}${pathname}`, { headers: { "X-Figma-Token": tok } });
  if (!res.ok)
    throw new Error(`Figma ${pathname.split("?")[0]}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function readFixture(name, { assets = false } = {}) {
  const file = path.join(fixturesDir, name, "fixture.json");
  if (!existsSync(file)) throw new Error(`No fixture at ${path.relative(root, file)}`);
  const fixture = JSON.parse(await readFile(file, "utf8"));
  // An import fixture replays a frame offline, so it takes assets (renders
  // and fills) from the frame's file but never a golden of its own.
  const kinds = assets ? ["figma", "import"] : ["figma"];
  if (!kinds.includes(fixture.kind) || !fixture.source?.fileKey || !fixture.source?.nodeId) {
    throw new Error(`${name} is not a figma fixture with a source`);
  }
  if (fixture.goldenFrom && !assets) {
    throw new Error(
      `${name} compares with ${fixture.goldenFrom}'s golden; fetch that fixture instead`,
    );
  }
  return fixture;
}

async function exportPng(fileKey, nodeId, out, tok) {
  const id = apiNodeId(nodeId);
  const images = await figma(
    `/images/${fileKey}?ids=${encodeURIComponent(id)}&format=png&scale=1`,
    tok,
  );
  const url = images.images?.[id];
  if (!url)
    throw new Error(`Figma rendered nothing for ${id}${images.err ? `: ${images.err}` : ""}`);
  const png = Buffer.from(await (await fetch(url)).arrayBuffer());
  await writeFile(out, png);
  return png.length;
}

async function fetchGolden(name) {
  const tok = await token();
  const { source } = await readFixture(name);
  const dir = path.join(fixturesDir, name);
  if (existsSync(path.join(dir, "golden.png")) && !process.argv.includes("--approved")) {
    throw new Error(`${name} already has a golden. Replacing it needs CJ's approval (--approved).`);
  }
  const bytes = await exportPng(source.fileKey, source.nodeId, path.join(dir, "golden.png"), tok);
  console.log(`golden.png      ${(bytes / 1024).toFixed(0)} KB`);
  const id = apiNodeId(source.nodeId);
  const nodes = await figma(
    `/files/${source.fileKey}/nodes?ids=${encodeURIComponent(id)}&geometry=paths`,
    tok,
  );
  const nodeFile = path.join(dir, "figma-node.json");
  const config = (await prettier.resolveConfig(nodeFile)) ?? {};
  const json = await prettier.format(JSON.stringify(nodes), { ...config, filepath: nodeFile });
  await writeFile(nodeFile, json);
  console.log(`figma-node.json ${(json.length / 1024).toFixed(0)} KB`);
}

async function fetchAsset(name, nodeId, file) {
  const tok = await token();
  const { source } = await readFixture(name, { assets: true });
  if (!/^[\w.-]+\.png$/.test(file)) throw new Error("The asset file is a bare name ending in .png");
  const bytes = await exportPng(source.fileKey, nodeId, path.join(fixturesDir, name, file), tok);
  console.log(`${file} ${(bytes / 1024).toFixed(0)} KB`);
}

async function fetchFill(name, imageRef, file) {
  const tok = await token();
  const { source } = await readFixture(name, { assets: true });
  if (!/^[\w.-]+\.(png|jpe?g|webp)$/.test(file)) {
    throw new Error("The fill file is a bare name ending in .png, .jpg or .webp");
  }
  const meta = await figma(`/files/${source.fileKey}/images`, tok);
  const url = meta.meta?.images?.[imageRef];
  if (!url) throw new Error(`Figma has no image fill ${imageRef} in ${source.fileKey}`);
  const bytes = Buffer.from(await (await fetch(url)).arrayBuffer());
  await writeFile(path.join(fixturesDir, name, file), bytes);
  console.log(`${file} ${(bytes.length / 1024).toFixed(0)} KB`);
}

const [mode, ...args] = process.argv.slice(2);
try {
  if (mode === "fetch" && args[0]) await fetchGolden(args[0]);
  else if (mode === "asset" && args[2]) await fetchAsset(args[0], args[1], args[2]);
  else if (mode === "fill" && args[2]) await fetchFill(args[0], args[1], args[2]);
  else usage();
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
