/**
 * The fidelity harness's pinned Google fonts.
 *
 * A fixture's page asks Google for its fonts twice: its own stylesheet
 * link, and again at export time, when the export fetches the family's
 * stylesheet and embeds the files it names. Google does not answer every
 * request alike. A few percent of the time it names a second build of the
 * same font version, whose letters land up to a pixel apart, so a row's
 * numbers depended on which build Google named that minute.
 *
 * So the harness answers every request to fonts.googleapis.com and
 * fonts.gstatic.com itself, from test/fidelity/google-fonts: recording.json
 * maps each engine's requests to bodies under files/. run, bless and
 * baseline only replay, and no request of theirs reaches Google. A request
 * the recording lacks is failed and its row errors, because the page would
 * have drawn a fallback face. The fonts command is the one place the
 * harness talks to Google: it fetches what the recording lacks and keeps
 * what it has.
 *
 * Playwright turns a page's HTTP cache off once the page has a route, so
 * every fixture page now loads the dev server's modules afresh. It changed
 * no row and no measurable run time.
 *
 * The decisions live in src/app/dev/fidelityFonts.ts, which has tests.
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  PINNED_FONT_URL,
  answeredKeys,
  bodyFileName,
  bodyFiles,
  recordable,
  recordingPart,
  recordingToSave,
  replayable,
  requestKey,
  usedKey,
} from "../../src/app/dev/fidelityFonts.ts";

const MANIFEST = "recording.json";
const BODIES = "files";
/** A recording run holds each page open after its render until the page
 * has had no font request in flight for this long, so the recording has
 * every request a slower run can make before its own render ends. */
const RECORD_QUIET_MS = 500;
const RECORD_QUIET_TIMEOUT_MS = 10_000;
/** What a recording run asks Google to encode with: the encodings
 * Playwright's fetch decodes. A browser may accept more, and a body that
 * came back undecoded would be kept as it is. */
const FETCH_ENCODINGS = "gzip, deflate, br";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Opens the recording in `dir`. With `record`, a request it lacks is
 * fetched from Google and kept; without, it goes unanswered. */
export async function openFontRecording(dir, { record = false } = {}) {
  const manifestFile = path.join(dir, MANIFEST);
  const bodyFile = (file) => path.join(dir, BODIES, file);
  const recording = existsSync(manifestFile)
    ? JSON.parse(await readFile(manifestFile, "utf8"))
    : {};
  // An answer with no body, or with a status no recording run keeps, is no
  // answer: a replay reports the request, and a recording run fetches it
  // again.
  const lost = [];
  for (const [engine, answers] of Object.entries(recording)) {
    for (const [key, answer] of Object.entries(answers)) {
      if (replayable(answer) && existsSync(bodyFile(answer.file))) continue;
      delete answers[key];
      lost.push(usedKey(engine, key));
    }
  }

  /** file -> its bytes, read once. */
  const bodies = new Map();
  /** Bodies this run fetched, to write on save. */
  const fetchedBodies = new Map();
  /** The answers this run fetched, as usedKey. */
  const fetched = new Set();
  /** One live fetch per request, however many ask at once. */
  const fetching = new Map();
  /** Why a request could not be recorded, by usedKey: its last failure. */
  const refusals = new Map();
  /** The requests the run's fixtures made and got answered, as usedKey.
   * Skipped fixtures are left out. */
  const used = new Set();
  /** The same for the requests that went unanswered. */
  const unanswered = new Set();

  const body = (file) => {
    if (!bodies.has(file)) bodies.set(file, readFile(bodyFile(file)));
    return bodies.get(file);
  };

  async function fetchLive(engine, key, route) {
    const id = usedKey(engine, key);
    try {
      const response = await route.fetch({
        headers: { ...route.request().headers(), "accept-encoding": FETCH_ENCODINGS },
      });
      const bytes = await response.body();
      const status = response.status();
      const contentType = response.headers()["content-type"] ?? "";
      if (!recordable(status, contentType, bytes)) {
        throw new Error(`Google answered ${status} ${contentType || "with no content type"}`);
      }
      const file = bodyFileName(createHash("sha256").update(bytes).digest("hex"), contentType);
      fetchedBodies.set(file, bytes);
      bodies.set(file, Promise.resolve(bytes));
      const answer = { status, contentType, file };
      (recording[engine] ??= {})[key] = answer;
      fetched.add(id);
      return answer;
    } catch (e) {
      refusals.set(id, e instanceof Error ? e.message.split("\n")[0] : String(e));
      throw e;
    }
  }

  return {
    /** True in a recording run. */
    record,

    /** Answers `page`'s Google font requests from before it navigates
     * until it closes. Returns `missed`, the requests it could not answer
     * (as requestKey, filled in as the page runs); settle(), to call
     * before the page closes; and keep(), which counts the page's requests
     * in the run. */
    async attach(page, engine) {
      // Whose answers this engine is given. webkit18 takes WebKit's, and
      // a recording run refuses it here, where the fetch would happen.
      const part = recordingPart(engine, record);
      const answered = new Set();
      const missed = [];
      let open = 0;
      let lastActivityAt = Date.now();
      const answer = async (route) => {
        const request = route.request();
        const key = requestKey(request.method(), request.url());
        const id = usedKey(part, key);
        let found;
        let bytes;
        try {
          found = recording[part]?.[key];
          if (!found && record) {
            // A fetch that failed is tried again by the next request.
            if (!fetching.has(id)) {
              fetching.set(
                id,
                fetchLive(part, key, route).finally(() => fetching.delete(id)),
              );
            }
            found = await fetching.get(id);
          }
          if (found) bytes = await body(found.file);
        } catch {
          found = undefined;
        }
        if (found) {
          try {
            await route.fulfill({
              status: found.status,
              headers: {
                "content-type": found.contentType,
                "access-control-allow-origin": "*",
              },
              body: bytes,
            });
            answered.add(key);
            return;
          } catch {
            // The page closed under the request and nothing waits for it.
            // On a live page, an answer the browser refused is no answer.
            if (page.isClosed()) return;
          }
        }
        missed.push(key);
        await route.abort().catch(() => undefined);
      };
      await page.route(PINNED_FONT_URL, async (route) => {
        open += 1;
        lastActivityAt = Date.now();
        try {
          await answer(route);
        } finally {
          open -= 1;
          lastActivityAt = Date.now();
        }
      });
      return {
        missed,
        /** A recording run waits here for the page's last font requests.
         * The route stays in place until the page closes: taking it off
         * first would let a request still in flight through to Google. */
        async settle() {
          if (!record) return;
          lastActivityAt = Date.now();
          const deadline = Date.now() + RECORD_QUIET_TIMEOUT_MS;
          while (
            (open > 0 || Date.now() - lastActivityAt < RECORD_QUIET_MS) &&
            Date.now() < deadline
          ) {
            await sleep(50);
          }
        },
        /** Counts this page's requests in the run. Not called for a
         * fixture that was skipped: its page asks Google for the family
         * whose file is missing, which is nothing to record or report. */
        keep() {
          for (const key of answered) used.add(usedKey(part, key));
          // Named by the engine that asked, so a request only webkit18
          // made reads as its own.
          for (const key of missed) unanswered.add(usedKey(engine, key));
        },
      };
    },

    /** The requests the run could not answer, as "engine METHOD url", with
     * the reason where a recording run has one. */
    unanswered: () =>
      [...unanswered].sort().map((id) => (refusals.has(id) ? `${id} (${refusals.get(id)})` : id)),

    /** Writes the recording: what this run fetched for a fixture that was
     * not skipped, and with `prune` without what no fixture used. Returns
     * what changed and what is kept. */
    async save({ prune }) {
      await Promise.allSettled([...fetching.values()]);
      const next = recordingToSave(recording, { used, fetched, prune });
      const wanted = bodyFiles(next.recording);
      await mkdir(path.join(dir, BODIES), { recursive: true });
      for (const [file, bytes] of fetchedBodies) {
        if (wanted.has(file)) await writeFile(bodyFile(file), bytes);
      }
      if (prune) {
        for (const entry of await readdir(path.join(dir, BODIES), { withFileTypes: true })) {
          if (entry.isFile() && !wanted.has(entry.name)) await rm(bodyFile(entry.name));
        }
      }
      await writeFile(manifestFile, JSON.stringify(next.recording, null, 2) + "\n");
      let bytes = 0;
      for (const file of wanted) bytes += (await stat(bodyFile(file))).size;
      // An answer that was unusable on opening and was not fetched again
      // is gone from the file too.
      const kept = answeredKeys(next.recording);
      return {
        added: next.added,
        removed: [...next.removed, ...lost.filter((id) => !kept.has(id))].sort(),
        answers: kept.size,
        files: wanted.size,
        bytes,
      };
    },
  };
}
