#!/usr/bin/env node
/**
 * The harness's stand-in for Safari before 26: the engine `webkit18`.
 *
 *   node scripts/fidelity/webkit18.mjs install
 *
 * The harness's own WebKit is the build its Playwright ships, 26.6 today,
 * and Safari 18 and older draw some things differently
 * (test/fidelity/README.md). This is the WebKit that Playwright 1.53.0
 * shipped: build 2182, which calls itself 18.5 and is dated 3 June 2025,
 * four weeks before WebKit changed how it clips what it paints under a
 * filter (bug 219520, first released in Safari 26.0).
 *
 * A Playwright release drives only its own browser builds, so that release
 * is installed beside the project's own as playwright-webkit-18, an npm
 * alias of playwright-core@1.53.0. Today's Playwright cannot drive the old
 * build: given its executablePath, it starts the build and then hangs.
 *
 * install stands in for that release's `playwright install webkit`, whose
 * unpacker stalls under Node 26 partway through the archive's first file.
 * It downloads the archive the release names, checks it against the
 * SHA-256 recorded below, unpacks it with the system's unzip, and leaves
 * the folder as Playwright would: its INSTALLATION_COMPLETE marker, and a
 * link in the cache's .links folder. Without the link the next
 * `playwright install`, of any release, removes the folder as unused.
 *
 * The browser cache is shared by every checkout on the machine, so the
 * build is unpacked beside its folder and moved into place whole: two
 * installs at once leave one complete folder, and a launch never meets a
 * half unpacked one.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, existsSync } from "node:fs";
import { chmod, mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

/** The engine's name in --engines, in a fixture's baselines and in reports. */
export const WEBKIT_18 = "webkit18";

const PACKAGE = "playwright-webkit-18";
const INSTALL = "node scripts/fidelity/webkit18.mjs install";
const DOWNLOAD_TIMEOUT_MS = 5 * 60_000;

/** The SHA-256 of each archive install has been checked against, by build
 * folder and file name. A host whose archive is not listed gets nothing
 * installed: add its line once its download has been looked at. macOS 15
 * and 26 on Apple silicon both take the one listed. */
const ARCHIVES = {
  "webkit-2182/webkit-mac-15-arm64.zip":
    "8e57f1a14d1a062a36f9400600a1bac4b10fd6cfcf61dacaa0aeb299e1de8d8b",
};

const require = createRequire(import.meta.url);

const fromOldPlaywright = (load) => {
  try {
    return load();
  } catch (e) {
    if (e?.code !== "MODULE_NOT_FOUND") throw e;
    throw new Error(`${PACKAGE} is not in node_modules. Run npm install.`, { cause: e });
  }
};

const markerFile = (directory) => path.join(directory, "INSTALLATION_COMPLETE");

/** The old WebKit as a Playwright browser type, to launch. Throws with the
 * command to run when the build is not installed, because the old
 * release's own advice (`playwright install`) is the command that stalls. */
export function webkit18() {
  const { webkit } = fromOldPlaywright(() => require(PACKAGE));
  if (!existsSync(markerFile(path.dirname(webkit.executablePath())))) {
    throw new Error(`The harness's WebKit 18.5 is not installed. Run \`${INSTALL}\`.`);
  }
  return webkit;
}

const sha256Of = async (file) => {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
};

/** Saves the first of `urls` that answers to `file`. */
async function download(urls, file) {
  let failure = new Error("No address to download from");
  for (const url of urls) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
      if (!response.ok || !response.body) throw new Error(`${url} answered ${response.status}`);
      await pipeline(Readable.fromWeb(response.body), createWriteStream(file));
      return url;
    } catch (e) {
      failure = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw failure;
}

/** Playwright's record of which install uses which browser folders: a file
 * named by the SHA-1 of a package's path, holding that path. An install
 * keeps the folders named by the browsers.json of every package linked. */
async function link(directory, packagePath) {
  const links = path.join(path.dirname(directory), ".links");
  await mkdir(links, { recursive: true });
  await writeFile(
    path.join(links, createHash("sha1").update(packagePath).digest("hex")),
    packagePath,
  );
}

async function install() {
  const executable = fromOldPlaywright(() =>
    require(`${PACKAGE}/lib/server`).registry.findExecutable("webkit"),
  );
  const packagePath = path.dirname(require.resolve(`${PACKAGE}/package.json`));
  const { directory } = executable;
  const build = path.basename(directory);
  const label = `WebKit ${executable.browserVersion} (${build})`;
  // The one folder this ever removes is the build's own, half unpacked.
  if (!/^webkit-\d+$/.test(build)) throw new Error(`Unexpected browser folder ${directory}`);
  if (existsSync(markerFile(directory))) {
    await link(directory, packagePath);
    console.log(`${label} is already at ${directory}`);
    return;
  }
  if (!executable.downloadURLs?.length) {
    throw new Error(`Playwright 1.53.0 has no WebKit build for this host.`);
  }
  const name = path.posix.basename(new URL(executable.downloadURLs[0]).pathname);
  const expected = ARCHIVES[`${build}/${name}`];
  if (!expected) {
    throw new Error(
      `No checksum is recorded for ${build}/${name}, this host's archive. ` +
        `Known: ${Object.keys(ARCHIVES).join(", ")} (scripts/fidelity/webkit18.mjs).`,
    );
  }
  const cache = path.dirname(directory);
  await mkdir(cache, { recursive: true });
  const scratch = await mkdtemp(path.join(os.tmpdir(), "socialpaint-webkit18-"));
  // Beside the build's folder, so the move into place is one rename. The
  // name starts with a dot: Playwright takes a folder named webkit-* here
  // for a browser of its own.
  const staging = await mkdtemp(path.join(cache, ".unpacking-webkit18-"));
  try {
    const archive = path.join(scratch, name);
    const from = await download(executable.downloadURLs, archive);
    const actual = await sha256Of(archive);
    if (actual !== expected) {
      throw new Error(`${from} is not the archive on record: SHA-256 ${actual}`);
    }
    const unzip = spawnSync("unzip", ["-q", archive, "-d", staging], {
      stdio: ["ignore", "inherit", "inherit"],
    });
    if (unzip.error || unzip.status !== 0) {
      throw new Error(
        `unzip could not unpack ${name}: ${unzip.error?.message ?? `exit ${unzip.status}`}`,
      );
    }
    const launcher = path.relative(directory, executable.executablePath("javascript"));
    await chmod(path.join(staging, launcher), 0o755);
    await writeFile(markerFile(staging), "");
    for (let attempt = 1; ; attempt += 1) {
      try {
        await rename(staging, directory);
        break;
      } catch (e) {
        // Something is there already. Another install's finished folder
        // stays, and a half unpacked one makes way, once.
        if (existsSync(markerFile(directory))) break;
        if (attempt === 2) throw e;
        await rm(directory, { recursive: true, force: true });
      }
    }
    await link(directory, packagePath);
    console.log(`${label} installed at ${directory}`);
  } finally {
    await rm(scratch, { recursive: true, force: true });
    await rm(staging, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] !== "install") {
    console.error(`Usage: ${INSTALL}`);
    process.exit(2);
  }
  try {
    await install();
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
}
