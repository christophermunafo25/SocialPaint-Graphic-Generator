import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  answeredKeys,
  bodyFileName,
  bodyFiles,
  inOrder,
  isPinnedFontUrl,
  outcomeWithFonts,
  recordable,
  recordingToSave,
  replayable,
  requestKey,
  sawEveryRequest,
  unansweredNote,
  usedKey,
  type FontRecording,
} from "./fidelityFonts";

const CSS = "https://fonts.googleapis.com/css2?family=Inter:wght@400&display=swap";
const FILE = "https://fonts.gstatic.com/s/inter/v20/abc.woff2";
const SHA = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const bytes = (text: string) => new TextEncoder().encode(text);

describe("isPinnedFontUrl", () => {
  it("pins Google's stylesheet API and its font files", () => {
    expect(isPinnedFontUrl(CSS)).toBe(true);
    expect(isPinnedFontUrl(FILE)).toBe(true);
  });

  it("leaves the dev server, data URLs and look-alike hosts alone", () => {
    expect(isPinnedFontUrl("http://127.0.0.1:4327/dev/render/gtm-composer")).toBe(false);
    expect(isPinnedFontUrl("data:font/woff2;base64,AAAA")).toBe(false);
    expect(isPinnedFontUrl("https://fonts.googleapis.com.example.com/css2")).toBe(false);
    expect(isPinnedFontUrl("https://example.com/?u=https://fonts.gstatic.com/a.woff2")).toBe(false);
    expect(isPinnedFontUrl("not a url")).toBe(false);
  });
});

describe("requestKey", () => {
  it("joins the method and the address", () => {
    expect(requestKey("get", CSS)).toBe(`GET ${CSS}`);
    expect(requestKey("HEAD", CSS)).toBe(`HEAD ${CSS}`);
  });
});

describe("bodyFileName", () => {
  it("names a body by its hash and its content type", () => {
    expect(bodyFileName(SHA, "text/css; charset=utf-8")).toBe("0123456789abcdef.css");
    expect(bodyFileName(SHA, "font/woff2")).toBe("0123456789abcdef.woff2");
    expect(bodyFileName(SHA, "Font/TTF")).toBe("0123456789abcdef.ttf");
  });

  it("files anything else as bin", () => {
    expect(bodyFileName(SHA, "text/html; charset=utf-8")).toBe("0123456789abcdef.bin");
    expect(bodyFileName(SHA, "")).toBe("0123456789abcdef.bin");
  });
});

describe("recordable", () => {
  const sheet = bytes("/* latin */\n@font-face {\n  font-family: 'Inter';\n}\n");
  const font = (signature: string) => bytes(`${signature}rest of the file`);

  it("keeps a stylesheet with a face in it", () => {
    expect(recordable(200, "text/css; charset=utf-8", sheet)).toBe(true);
  });

  it("keeps a font file in any format Google serves", () => {
    expect(recordable(200, "font/woff2", font("wOF2"))).toBe(true);
    expect(recordable(200, "font/woff", font("wOFF"))).toBe(true);
    expect(recordable(200, "font/ttf", font("\u0000\u0001\u0000\u0000"))).toBe(true);
    expect(recordable(200, "font/otf", font("OTTO"))).toBe(true);
  });

  it("keeps Google's refusal of a family it does not serve", () => {
    expect(recordable(400, "text/html; charset=utf-8", bytes("<html>400</html>"))).toBe(true);
  });

  it("drops a failure that would pass on its own", () => {
    expect(recordable(503, "text/html", bytes("Service Unavailable"))).toBe(false);
    expect(recordable(429, "text/html", bytes("Too Many Requests"))).toBe(false);
    expect(recordable(404, "text/html", bytes("Not Found"))).toBe(false);
    expect(recordable(302, "text/html", bytes(""))).toBe(false);
  });

  it("drops a page served in a stylesheet's or a font's place", () => {
    expect(recordable(200, "text/html", bytes("<html>Sign in to the network</html>"))).toBe(false);
    expect(recordable(200, "text/css", bytes("<html>Sign in to the network</html>"))).toBe(false);
    expect(recordable(200, "font/woff2", bytes("<html>Sign in</html>"))).toBe(false);
  });

  it("drops a body the fetch did not decode", () => {
    const compressed = new Uint8Array([0x28, 0xb5, 0x2f, 0xfd, 0x04, 0x58, 0x45, 0x00]);
    expect(recordable(200, "text/css; charset=utf-8", compressed)).toBe(false);
    expect(recordable(200, "font/woff2", compressed)).toBe(false);
    expect(recordable(200, "font/woff2", new Uint8Array())).toBe(false);
  });
});

describe("replayable", () => {
  it("replays the statuses a recording run keeps and no other", () => {
    const answer = { contentType: "text/css", file: "aaaa.css" };
    expect(replayable({ ...answer, status: 200 })).toBe(true);
    expect(replayable({ ...answer, status: 400 })).toBe(true);
    expect(replayable({ ...answer, status: 301 })).toBe(false);
    expect(replayable({ ...answer, status: 503 })).toBe(false);
  });
});

describe("unansweredNote", () => {
  it("counts in plain words", () => {
    expect(unansweredNote(1, false)).toBe("1 Google font request is not in the recording");
    expect(unansweredNote(3, false)).toBe("3 Google font requests are not in the recording");
    expect(unansweredNote(1, true)).toBe("1 Google font request could not be recorded");
    expect(unansweredNote(2, true)).toBe("2 Google font requests could not be recorded");
  });
});

describe("outcomeWithFonts", () => {
  const rendered = { status: "rendered", file: "f.png" } as const;

  it("leaves a fixture alone when every request was answered", () => {
    expect(outcomeWithFonts(rendered, [], false)).toBe(rendered);
  });

  it("turns a render that drew without a pinned font into an error", () => {
    expect(outcomeWithFonts(rendered, [CSS, FILE], false)).toEqual({
      status: "error",
      message: "2 Google font requests are not in the recording",
    });
  });

  it("counts a request made twice once", () => {
    expect(outcomeWithFonts(rendered, [CSS, CSS], false)).toEqual({
      status: "error",
      message: "1 Google font request is not in the recording",
    });
  });

  it("keeps what else went wrong", () => {
    expect(outcomeWithFonts({ status: "error", message: "Timeout" }, [CSS], true)).toEqual({
      status: "error",
      message: "1 Google font request could not be recorded; Timeout",
    });
  });

  it("keeps a fixture skipped for a missing font file skipped", () => {
    const skipped = { status: "skipped", reason: "missing font Private.woff2" } as const;
    expect(outcomeWithFonts(skipped, [CSS], false)).toBe(skipped);
  });
});

describe("sawEveryRequest", () => {
  const rendered = { status: "rendered", file: "f.png" } as const;
  const all = { everyFixture: true, everyEngine: true, outcomes: [rendered, rendered] };

  it("is true when every fixture rendered in every engine", () => {
    expect(sawEveryRequest(all)).toBe(true);
  });

  it("is false for a run of some fixtures or some engines", () => {
    expect(sawEveryRequest({ ...all, everyFixture: false })).toBe(false);
    expect(sawEveryRequest({ ...all, everyEngine: false })).toBe(false);
  });

  it("is false when a fixture was skipped or errored", () => {
    const skipped = { status: "skipped", reason: "missing font" } as const;
    const error = { status: "error", message: "Timeout" } as const;
    expect(sawEveryRequest({ ...all, outcomes: [rendered, skipped] })).toBe(false);
    expect(sawEveryRequest({ ...all, outcomes: [rendered, error] })).toBe(false);
  });

  it("is false for a run that rendered nothing", () => {
    expect(sawEveryRequest({ ...all, outcomes: [] })).toBe(false);
  });
});

describe("the recording a run leaves behind", () => {
  const css = { status: 200, contentType: "text/css; charset=utf-8", file: "aaaa.css" };
  const font = { status: 200, contentType: "font/woff2", file: "bbbb.woff2" };
  const other = { status: 200, contentType: "font/woff2", file: "cccc.woff2" };
  const cssKey = requestKey("GET", CSS);
  const fileKey = requestKey("GET", FILE);
  const recording: FontRecording = {
    webkit: { [fileKey]: font, [cssKey]: css },
    chromium: { [cssKey]: css, [fileKey]: other },
  };
  const none: ReadonlySet<string> = new Set();
  const everything = answeredKeys(recording);

  it("keeps every earlier answer when it does not prune, used or not", () => {
    const saved = recordingToSave(recording, { used: none, fetched: none, prune: false });
    expect(saved).toEqual({ recording, added: [], removed: [] });
  });

  it("names what it fetched and a fixture used", () => {
    const fetched = new Set([usedKey("webkit", fileKey)]);
    const saved = recordingToSave(recording, { used: fetched, fetched, prune: false });
    expect(saved.recording).toEqual(recording);
    expect(saved.added).toEqual([usedKey("webkit", fileKey)]);
    expect(saved.removed).toEqual([]);
  });

  it("never keeps an answer it fetched for a skipped fixture alone", () => {
    const fetched = new Set([usedKey("webkit", fileKey)]);
    for (const prune of [false, true]) {
      const used = prune ? new Set([...everything].filter((id) => !fetched.has(id))) : none;
      const saved = recordingToSave(recording, { used, fetched, prune });
      expect(saved.recording).toEqual({ chromium: recording.chromium, webkit: { [cssKey]: css } });
      expect(saved.added).toEqual([]);
      expect(saved.removed).toEqual([]);
    }
  });

  it("drops the answers nothing asked for when it prunes, and names them", () => {
    const used = new Set([
      usedKey("chromium", cssKey),
      usedKey("webkit", cssKey),
      usedKey("webkit", fileKey),
    ]);
    const saved = recordingToSave(recording, { used, fetched: none, prune: true });
    expect(saved.recording).toEqual({
      chromium: { [cssKey]: css },
      webkit: { [cssKey]: css, [fileKey]: font },
    });
    expect(saved.removed).toEqual([usedKey("chromium", fileKey)]);
    expect(bodyFiles(saved.recording)).toEqual(new Set(["aaaa.css", "bbbb.woff2"]));
  });

  it("drops an engine left with nothing", () => {
    const used = new Set([usedKey("webkit", cssKey)]);
    const saved = recordingToSave(recording, { used, fetched: none, prune: true });
    expect(Object.keys(saved.recording)).toEqual(["webkit"]);
  });

  it("is written with engines and requests in order", () => {
    const ordered = inOrder({ ...recording, firefox: {} });
    expect(Object.keys(ordered)).toEqual(["chromium", "webkit"]);
    expect(Object.keys(ordered.webkit ?? {})).toEqual([cssKey, fileKey]);
    expect(ordered).toEqual(recording);
    const saved = recordingToSave(recording, { used: none, fetched: none, prune: false });
    expect(JSON.stringify(saved.recording)).toBe(JSON.stringify(ordered));
  });

  it("lists each body file and each answer once", () => {
    expect(bodyFiles(recording)).toEqual(new Set(["aaaa.css", "bbbb.woff2", "cccc.woff2"]));
    expect(everything).toEqual(
      new Set([
        usedKey("chromium", cssKey),
        usedKey("chromium", fileKey),
        usedKey("webkit", cssKey),
        usedKey("webkit", fileKey),
      ]),
    );
  });
});

// The recording in the repository, checked without a browser: a change that
// needs `node scripts/fidelity/fidelity.mjs fonts` should say so in
// `npm run verify`, on the pull request that makes it, not in the next
// fidelity run on somebody else's.
describe("test/fidelity/google-fonts", () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
  const dir = path.join(root, "test/fidelity/google-fonts");
  const recording = JSON.parse(
    readFileSync(path.join(dir, "recording.json"), "utf8"),
  ) as FontRecording;
  const engines = ["chromium", "firefox", "webkit"] as const;
  const fix =
    "run `node scripts/fidelity/fidelity.mjs fonts` and commit test/fidelity/google-fonts";

  it("has a replayable answer with a body for every request", () => {
    const answers = engines.flatMap((engine) => Object.entries(recording[engine] ?? {}));
    expect(answers.length).toBeGreaterThan(0);
    for (const [key, answer] of answers) {
      expect(replayable(answer), key).toBe(true);
      expect(existsSync(path.join(dir, "files", answer.file)), `${key}: ${answer.file}`).toBe(true);
    }
  });

  it("is in the order the runner writes it", () => {
    expect(JSON.stringify(recording)).toBe(JSON.stringify(inOrder(recording)));
  });

  // Every fixture's page loads the platform stylesheet, so each Google
  // stylesheet it imports is a request every row makes.
  it("answers the Google stylesheets socialpaint.css imports, in every engine", () => {
    const sheet = readFileSync(path.join(root, "src/styles/socialpaint.css"), "utf8");
    const imports = [...sheet.matchAll(/@import\s+(?:url\(\s*)?["']?([^"')\s]+)/g)]
      .map((match) => match[1])
      .filter(isPinnedFontUrl);
    // Today that is Geist Mono. Fewer is fine; more must be recorded.
    for (const url of imports) {
      const key = requestKey("GET", new URL(url).href);
      for (const engine of engines) {
        expect(recording[engine]?.[key], `${engine} ${key}: ${fix}`).toBeDefined();
      }
    }
  });
});
