import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Chrome faces live under private " Platform" names so a tenant font can never
// shadow them, and a template's catalogue font is never shadowed by the chrome
// (the Neuething incident, 2026-08-05). See the policy note in socialpaint.css.
const dir = path.dirname(fileURLToPath(import.meta.url));
const sheets = readdirSync(dir)
  .filter((f) => f.endsWith(".css"))
  .map((f) => ({ file: f, css: readFileSync(path.join(dir, f), "utf8") }));
const faces = sheets.flatMap(({ file, css }) =>
  [...css.matchAll(/@font-face\s*{([^}]*)}/g)].map((m) => ({ file, body: m[1] })),
);
const family = (body: string) => /font-family:\s*["']([^"']+)["']/.exec(body)?.[1];

describe("platform fonts", () => {
  it("registers every @font-face under a private Platform name", () => {
    expect(faces.length).toBeGreaterThan(0);
    for (const { file, body } of faces) expect(family(body), file).toMatch(/ Platform$/);
  });

  it("points every @font-face url() at a file that exists", () => {
    for (const { file, body } of faces) {
      for (const [, url] of body.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
        expect(existsSync(path.resolve(dir, url)), `${file}: ${url}`).toBe(true);
      }
    }
  });

  it("leads the head, body and UI stacks with a Platform family", () => {
    const css = sheets.find((s) => s.file === "socialpaint.css")!.css;
    for (const name of ["--font-head", "--font-body", "--font-ui"]) {
      const stack = new RegExp(`${name}:\\s*([^;]+);`).exec(css)?.[1] ?? "";
      expect(/^["']([^"']+)["']/.exec(stack.trim())?.[1], name).toMatch(/ Platform$/);
    }
  });
});
