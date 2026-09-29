import { describe, expect, it, vi } from "vitest";
import {
  DocumentReadError,
  MAX_DOCUMENT_BYTES,
  MAX_PDF_PAGES,
  cleanDocumentText,
  documentKindOf,
  readDocument,
  type PdfTextReader,
} from "./documentText";
import { MAX_DOCUMENT_TEXT, buildGenerateInput } from "./chatReducer";
import type { UserTurn } from "./chat";

const file = (name: string, body: string | Uint8Array<ArrayBuffer>, type = ""): File =>
  new File([body], name, { type });

const problemOf = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(DocumentReadError);
    return (e as DocumentReadError).problem;
  }
  throw new Error("expected a refusal");
};

describe("documentKindOf", () => {
  it("reads the kind from the extension, then the type", () => {
    expect(documentKindOf({ name: "Job post.PDF", type: "" })).toBe("pdf");
    expect(documentKindOf({ name: "notes.md", type: "" })).toBe("md");
    expect(documentKindOf({ name: "notes.txt", type: "" })).toBe("txt");
    expect(documentKindOf({ name: "blob", type: "application/pdf" })).toBe("pdf");
    expect(documentKindOf({ name: "brief.docx", type: "" })).toBeNull();
    expect(documentKindOf({ name: "photo.png", type: "image/png" })).toBeNull();
  });
});

describe("cleanDocumentText", () => {
  it("collapses whitespace and caps at 12,000 characters", () => {
    expect(cleanDocumentText("  Creative\n\n Director\t remote  ")).toBe(
      "Creative Director remote",
    );
    expect(cleanDocumentText("x ".repeat(20_000))).toHaveLength(MAX_DOCUMENT_TEXT);
  });

  it("never splits a surrogate pair at the cap", () => {
    const text = cleanDocumentText(`${"a".repeat(MAX_DOCUMENT_TEXT - 1)}😀tail`);
    expect(text).toHaveLength(MAX_DOCUMENT_TEXT - 1);
  });
});

describe("readDocument", () => {
  it("reads a text file, trimmed and collapsed", async () => {
    const doc = await readDocument(file("job.txt", "Creative Director\nRemote, starts October.\n"));
    expect(doc).toEqual({
      name: "job.txt",
      kind: "txt",
      text: "Creative Director Remote, starts October.",
    });
  });

  it("refuses the wrong type, an oversize file, and too little text", async () => {
    expect(await problemOf(readDocument(file("brief.docx", "x".repeat(50))))).toBe("type");
    const big = file("big.txt", new Uint8Array(MAX_DOCUMENT_BYTES + 1));
    expect(await problemOf(readDocument(big))).toBe("size");
    expect(await problemOf(readDocument(file("empty.md", "   short   ")))).toBe("empty");
  });

  it("reads a PDF through the injected reader, asking for 10 pages at most", async () => {
    const reader = vi.fn<PdfTextReader>(async () => "Page one text. ".repeat(3000));
    const doc = await readDocument(file("job.pdf", "%PDF-1.7"), async () => reader);
    expect(reader).toHaveBeenCalledWith(expect.any(ArrayBuffer), {
      maxPages: MAX_PDF_PAGES,
      maxChars: MAX_DOCUMENT_TEXT * 2,
    });
    expect(doc.kind).toBe("pdf");
    expect(doc.text.length).toBeLessThanOrEqual(MAX_DOCUMENT_TEXT);
  });

  it("treats a password-protected or broken PDF as having no text", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const reader: PdfTextReader = async () => {
      throw Object.assign(new Error("No password given"), { name: "PasswordException" });
    };
    expect(await problemOf(readDocument(file("locked.pdf", "%PDF"), async () => reader))).toBe(
      "empty",
    );
    log.mockRestore();
  });
});

describe("the document on the wire", () => {
  const user = (over: Partial<UserTurn> = {}): UserTurn => ({
    id: "u1",
    role: "user",
    text: "Make a post from this",
    createdAt: "2026-09-29T00:00:00Z",
    variations: 1,
    intent: "brief",
    ...over,
  });

  it("goes with its own message, capped, and never on a message without one", () => {
    const input = buildGenerateInput(
      [],
      user({ document: { name: "n".repeat(200), kind: "pdf", text: "t".repeat(20_000) } }),
      "library",
    );
    expect(input.documents).toHaveLength(1);
    expect(input.documents![0].name).toHaveLength(120);
    expect(input.documents![0].text).toHaveLength(MAX_DOCUMENT_TEXT);
    expect(buildGenerateInput([], user(), "library").documents).toBeUndefined();
  });
});
