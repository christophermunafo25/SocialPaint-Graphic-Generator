// The fidelity runner's pinned Google fonts (scripts/fidelity/fontRecording.mjs):
// which requests the recording answers, which of Google's answers are worth
// keeping, how an answer is keyed and filed, what a request that went
// unanswered does to a row, and what a recording run leaves behind.
// Dependency-free and erasable TypeScript, like fidelityVerdict.ts: Node runs
// this file directly from the script and Vitest tests it here.

import type { Engine, RenderOutcome } from "./fidelityVerdict";

/** Google's font hosts: the stylesheet API, and the font files its
 * stylesheets name. The runner routes every address this matches. */
export const PINNED_FONT_URL = /^https?:\/\/fonts\.(?:googleapis|gstatic)\.com\//;

/** One recorded answer. `file` names its body under files/. */
export interface RecordedAnswer {
  status: number;
  contentType: string;
  file: string;
}

/** recording.json: each engine's requests and their answers. Per engine,
 * because Google answers each browser its own way. */
export type FontRecording = Partial<Record<Engine, Record<string, RecordedAnswer>>>;

/** The engine whose recorded answers an engine is given: its own, except
 * for webkit18 (scripts/fidelity/webkit18.mjs), which has none and takes
 * WebKit's. Its page asks Google for the same stylesheets, so the answers
 * name the same files, and a request WebKit never made fails its row like
 * any other the recording lacks. Given those answers it drew every fixture's
 * text as Safari 18.6 drew it from Google itself (2026-11-18). */
export function recordingEngine(engine: Engine): Engine {
  return engine === "webkit18" ? "webkit" : engine;
}

/** True for a request the recording answers. Anything else (the dev
 * server, a fixture's images) is not the recording's to answer. */
export function isPinnedFontUrl(url: string): boolean {
  return PINNED_FONT_URL.test(url);
}

/** A request's key within its engine's part of the recording. */
export function requestKey(method: string, url: string): string {
  return `${method.toUpperCase()} ${url}`;
}

/** One request by one engine, as the set of requests a run made holds it. */
export function usedKey(engine: Engine, key: string): string {
  return `${engine} ${key}`;
}

const mediaType = (contentType: string) => contentType.split(";")[0].trim().toLowerCase();

const EXTENSIONS: Array<[string, string]> = [
  ["text/css", "css"],
  ["font/woff2", "woff2"],
  ["font/woff", "woff"],
  ["font/ttf", "ttf"],
  ["font/otf", "otf"],
];

/** The file a body is stored under: the first 16 hex digits of its SHA-256
 * and an extension from its content type. Named by content, so a body is
 * stored once however many requests and engines it answers. */
export function bodyFileName(sha256Hex: string, contentType: string): string {
  const type = mediaType(contentType);
  const extension = EXTENSIONS.find(([t]) => t === type)?.[1] ?? "bin";
  return `${sha256Hex.slice(0, 16)}.${extension}`;
}

/** The statuses a recording holds: a served answer, and Google's refusal
 * of a family it does not have. */
const KEPT_STATUSES = new Set([200, 400]);

/** How a font file starts: WOFF2, WOFF, OpenType, TrueType (two ways) and
 * a collection. */
const FONT_SIGNATURES = ["wOF2", "wOFF", "OTTO", "\u0000\u0001\u0000\u0000", "true", "ttcf"];

/** Whether an answer in recording.json is one the runner replays. A
 * hand-edited status it would never have recorded is no answer. */
export function replayable(answer: RecordedAnswer): boolean {
  return KEPT_STATUSES.has(answer.status);
}

/** Whether an answer from Google is worth keeping. A recording run never
 * fetches an answer it already has, so a passing failure kept once would
 * be replayed for good: a 503, a rate limit, a network's sign-in page, or
 * a body the fetch did not decode. Kept: a stylesheet with a face in it, a
 * font file, and Google's 400 for a family it does not serve (a fixture
 * may name a system font, and the app asks Google for it all the same). */
export function recordable(status: number, contentType: string, body: Uint8Array): boolean {
  if (status === 400) return true;
  if (status !== 200) return false;
  const type = mediaType(contentType);
  if (type === "text/css") return new TextDecoder().decode(body).includes("@font-face");
  if (!type.startsWith("font/")) return false;
  const start = String.fromCharCode(...body.subarray(0, 4));
  return FONT_SIGNATURES.includes(start);
}

/** The note on a row whose page asked Google for something the harness
 * could not answer. `recording` is true in a recording run, where an
 * unanswered request is one Google itself did not answer usably. */
export function unansweredNote(count: number, recording: boolean): string {
  const requests = count === 1 ? "1 Google font request" : `${count} Google font requests`;
  if (recording) return `${requests} could not be recorded`;
  return `${requests} ${count === 1 ? "is" : "are"} not in the recording`;
}

/** What unanswered font requests do to a fixture's outcome. The page drew
 * a fallback face for them, or the export embedded nothing, so a render
 * that made one is an error and never a pass, however close its pixels
 * land. A fixture skipped for a missing font file stays skipped: it
 * rendered nothing, and its page asks Google for the family whose file is
 * missing, which no recording should answer. */
export function outcomeWithFonts(
  outcome: RenderOutcome,
  unanswered: string[],
  recording: boolean,
): RenderOutcome {
  if (unanswered.length === 0 || outcome.status === "skipped") return outcome;
  const note = unansweredNote(new Set(unanswered).size, recording);
  return {
    status: "error",
    message: outcome.status === "error" ? `${note}; ${outcome.message}` : note,
  };
}

/** Whether a recording run made every request the fixtures can make, so
 * the answers it did not use can be dropped: it rendered every fixture in
 * every engine. A fixture that was skipped or errored made only some of
 * its requests, and dropping the rest would break it wherever it does
 * render. */
export function sawEveryRequest(run: {
  everyFixture: boolean;
  everyEngine: boolean;
  outcomes: RenderOutcome[];
}): boolean {
  return (
    run.everyFixture &&
    run.everyEngine &&
    run.outcomes.length > 0 &&
    run.outcomes.every((o) => o.status === "rendered")
  );
}

/** The recording a run leaves behind, in the order it is written.
 *
 * `used` holds the requests the run's fixtures made (as usedKey), skipped
 * fixtures left out. `fetched` holds the answers this run fetched. An
 * answer fetched for nobody is never kept: only a skipped fixture asked.
 * An answer from an earlier run stays unless `prune` is set, when every
 * answer nothing used goes. `added` and `removed` name what changed. */
export function recordingToSave(
  recording: FontRecording,
  run: { used: ReadonlySet<string>; fetched: ReadonlySet<string>; prune: boolean },
): { recording: FontRecording; added: string[]; removed: string[] } {
  const next: FontRecording = {};
  const added: string[] = [];
  const removed: string[] = [];
  for (const [engine, answers] of entries(recording)) {
    for (const [key, answer] of Object.entries(answers)) {
      const id = usedKey(engine, key);
      const fresh = run.fetched.has(id);
      if (run.used.has(id) || (!fresh && !run.prune)) {
        (next[engine] ??= {})[key] = answer;
        if (fresh) added.push(id);
      } else if (!fresh) {
        removed.push(id);
      }
    }
  }
  return { recording: inOrder(next), added: added.sort(), removed: removed.sort() };
}

/** The recording as it is written: engines and requests in order, so the
 * file's diff shows only what changed. Engines with no answers are left
 * out. */
export function inOrder(recording: FontRecording): FontRecording {
  const next: FontRecording = {};
  for (const [engine, answers] of entries(recording).sort(([a], [b]) => a.localeCompare(b))) {
    const keys = Object.keys(answers).sort();
    if (keys.length === 0) continue;
    next[engine] = Object.fromEntries(keys.map((key) => [key, answers[key]]));
  }
  return next;
}

/** Every request the recording answers, as usedKey. */
export function answeredKeys(recording: FontRecording): Set<string> {
  const keys = new Set<string>();
  for (const [engine, answers] of entries(recording)) {
    for (const key of Object.keys(answers)) keys.add(usedKey(engine, key));
  }
  return keys;
}

/** Every body file the recording names. */
export function bodyFiles(recording: FontRecording): Set<string> {
  const files = new Set<string>();
  for (const [, answers] of entries(recording)) {
    for (const answer of Object.values(answers)) files.add(answer.file);
  }
  return files;
}

const entries = (recording: FontRecording) =>
  Object.entries(recording) as Array<[Engine, Record<string, RecordedAnswer>]>;
