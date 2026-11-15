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

  it("leads the head, body and sans stacks with a Platform family", () => {
    const sheet = (file: string) => sheets.find((s) => s.file === file)!.css;
    const declared = (css: string, name: string) =>
      new RegExp(`${name}:\\s*([^;]+);`).exec(css)?.[1].trim() ?? "";
    const stacks = [
      ["--font-head", declared(sheet("socialpaint.css"), "--font-head")],
      ["--font-body", declared(sheet("socialpaint.css"), "--font-body")],
      // The generated token. Figma holds the public family name and the
      // generator writes the private stack (scripts/build-tokens.mjs).
      ["--font-sans", declared(sheet("tokens.css"), "--font-sans")],
    ];
    for (const [name, stack] of stacks) {
      expect(/^["']([^"']+)["']/.exec(stack)?.[1], name).toMatch(/ Platform$/);
    }
    // The older name follows the token through the bridge.
    expect(declared(sheet("legacy-bridge.css"), "--font-ui")).toBe("var(--font-sans)");
  });
});
