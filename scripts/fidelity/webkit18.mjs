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
import { createReadStream, createWriteStream, existsSync, realpathSync } from "node:fs";
import { chmod, mkdir, mkdtemp, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
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
/** What a host that cannot have the build is told. */
const WITHOUT_IT = "The other engines run without it: --engines chromium,firefox,webkit.";
const DOWNLOAD_TIMEOUT_MS = 5 * 60_000;
/** What install names the folders it unpacks into, in the browser cache.
 * The dot matters: Playwright takes a folder named webkit-* there for a
 * browser of its own. */
const STAGING = ".unpacking-webkit18-";
/** A staging folder this old was left by an install that was killed.
 * Unpacking takes seconds. */
const STALE_STAGING_MS = 60 * 60_000;
/** How often the move into place is tried. Each failure after the first
 * is another install acting on the folder in the same instant. */
const MOVE_ATTEMPTS = 5;

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
    throw new Error(`${PACKAGE} is not in node_modules. Run npm install.`, {
      cause: e,
    });
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

/** Saves to `file` the first of `urls` whose body has the SHA-256
 * `expected`. A mirror that fails, or serves anything else, is passed over
 * and named if none will do. */
async function download(urls, file, expected) {
  const failures = [];
  for (const url of urls) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
      });
      if (!response.ok || !response.body) throw new Error(`answered ${response.status}`);
      await pipeline(Readable.fromWeb(response.body), createWriteStream(file));
      const actual = await sha256Of(file);
      if (actual !== expected) throw new Error(`is not the archive on record (SHA-256 ${actual})`);
      return;
    } catch (e) {
      // fetch says only "fetch failed"; its cause says why.
      const reason = e instanceof Error ? (e.cause?.message ?? e.message) : String(e);
      failures.push(`${url}: ${reason}`);
    }
  }
  throw new Error(`Could not download the archive.\n  ${failures.join("\n  ")}`);
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

/** Removes the staging folders that installs which were killed left in the
 * cache. Nothing else would: the dot hides them from Playwright. This is
 * housekeeping: what it cannot read or remove it leaves, and the install
 * goes on. */
async function removeStaleStaging(cache) {
  for (const entry of await readdir(cache).catch(() => [])) {
    if (!entry.startsWith(STAGING)) continue;
    const folder = path.join(cache, entry);
    const modified = await stat(folder).then(
      (s) => s.mtimeMs,
      () => Date.now(),
    );
    if (Date.now() - modified > STALE_STAGING_MS) {
      await rm(folder, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}

/** Moves a fully unpacked build into place. Another install's finished
 * folder stays where it is. A half unpacked one makes way, and is moved
 * aside before it is removed: if another install finished there in the
 * meantime, what was moved aside is its folder, and it goes back. The move
 * is tried a few times, because installs running at once can each find the
 * folder mid-move. */
async function moveIntoPlace(staging, directory) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await rename(staging, directory);
      return;
    } catch (e) {
      if (existsSync(markerFile(directory))) return;
      if (attempt === MOVE_ATTEMPTS) throw e;
      const aside = await mkdtemp(path.join(path.dirname(directory), STAGING));
      try {
        await rename(directory, aside);
        if (existsSync(markerFile(aside))) await rename(aside, directory);
      } catch {
        // It is gone already, or another install's folder is there now.
      }
      await rm(aside, { recursive: true, force: true });
    }
  }
}

async function install() {
  const executable = fromOldPlaywright(() =>
    require(`${PACKAGE}/lib/server`).registry.findExecutable("webkit"),
  );
  const packagePath = path.dirname(require.resolve(`${PACKAGE}/package.json`));
  const { directory } = executable;
  const build = path.basename(directory);
  const label = `WebKit ${executable.browserVersion} (${build})`;
  // The one browser folder this ever removes is the build's own, half
  // unpacked.
  if (!/^webkit-\d+$/.test(build)) throw new Error(`Unexpected browser folder ${directory}`);
  if (existsSync(markerFile(directory))) {
    await link(directory, packagePath);
    console.log(`${label} is already at ${directory}`);
    return;
  }
  if (!executable.downloadURLs?.length) {
    throw new Error(`Playwright 1.53.0 has no WebKit build for this host. ${WITHOUT_IT}`);
  }
  const name = path.posix.basename(new URL(executable.downloadURLs[0]).pathname);
  const expected = ARCHIVES[`${build}/${name}`];
  if (!expected) {
    throw new Error(
      `No checksum is recorded for ${build}/${name}, this host's archive. ` +
        `Known: ${Object.keys(ARCHIVES).join(", ")} (scripts/fidelity/webkit18.mjs). ${WITHOUT_IT}`,
    );
  }
  // The link goes first, as in Playwright's own install: from the moment
  // the folder is in place, a `playwright install` in another checkout
  // finds it named.
  await link(directory, packagePath);
  const cache = path.dirname(directory);
  await removeStaleStaging(cache);
  let scratch;
  let staging;
  try {
    scratch = await mkdtemp(path.join(os.tmpdir(), "socialpaint-webkit18-"));
    // Beside the build's folder, so the move into place is one rename.
    staging = await mkdtemp(path.join(cache, STAGING));
    const archive = path.join(scratch, name);
    await download(executable.downloadURLs, archive, expected);
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
    // mkdtemp makes a folder only its owner can open; Playwright's are 755.
    await chmod(staging, 0o755);
    await writeFile(markerFile(staging), "");
    await moveIntoPlace(staging, directory);
    console.log(`${label} installed at ${directory}`);
  } finally {
    if (scratch) await rm(scratch, { recursive: true, force: true });
    if (staging) await rm(staging, { recursive: true, force: true });
  }
}

// True only for the file node was started with, whatever path it was
// reached by. argv holds the path as it was typed, which through a
// symlinked folder is not this file's own, and the install would then do
// nothing and exit 0. Node before 24.2 has no import.meta.main.
const startedDirectly =
  import.meta.main ??
  (Boolean(process.argv[1]) && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url));
if (startedDirectly) {
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
