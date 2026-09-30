// Documents attached to a chat message (Template chat PROMPT §12.3): read
// in the browser, text only. Nothing here uploads anything: the file is
// read into memory, its text extracted, collapsed and capped, and the text
// rides on the message it was attached to. The server holds the same caps
// (template-generate §10.1).

import type { ChatDocumentKind } from "../types";
import type { ChatDocument } from "./chat";
import { MAX_DOCUMENT_TEXT } from "./chatReducer";

/** The largest file the File row takes. */
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
/** Only the first pages of a PDF are read. */
export const MAX_PDF_PAGES = 10;
/** Less text than this is a scanned PDF or an empty file, not a document. */
export const MIN_DOCUMENT_CHARS = 20;

/** The native picker's list for the File row. */
export const DOCUMENT_ACCEPT = ".pdf,.txt,.md,application/pdf,text/plain,text/markdown";

export type DocumentProblem = "type" | "size" | "empty";

export class DocumentReadError extends Error {
  readonly problem: DocumentProblem;
  constructor(problem: DocumentProblem) {
    super(documentProblemMessage(problem));
    this.name = "DocumentReadError";
    this.problem = problem;
  }
}

/** Member-facing copy for a refused document (PROMPT §15). A password
 * protected PDF reads as one with no text: nothing could be taken from it. */
export function documentProblemMessage(problem: DocumentProblem): string {
  switch (problem) {
    case "size":
      return "That file is over 10 MB";
    case "type":
      return "Attach a PDF, TXT or MD file";
    case "empty":
      return "Couldn't find any text in that file";
  }
}

/** The kind of a file by its extension, then its type. Null for anything
 * the File row does not take. */
export function documentKindOf(file: { name: string; type: string }): ChatDocumentKind | null {
  const ext = file.name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  if (ext === "pdf") return "pdf";
  if (ext === "txt") return "txt";
  if (ext === "md" || ext === "markdown") return "md";
  if (file.type === "application/pdf") return "pdf";
  if (file.type === "text/markdown") return "md";
  if (file.type === "text/plain") return "txt";
  return null;
}

/** Whitespace collapsed to single spaces, trimmed, capped at the server's
 * 12,000 characters (never splitting a surrogate pair). */
export function cleanDocumentText(raw: string): string {
  const text = raw.replace(/\s+/g, " ").trim();
  if (text.length <= MAX_DOCUMENT_TEXT) return text;
  let cut = text.slice(0, MAX_DOCUMENT_TEXT);
  if (/[\ud800-\udbff]$/.test(cut)) cut = cut.slice(0, -1);
  return cut;
}

/** Reads a PDF's text: at most `maxPages` pages, stopping once `maxChars`
 * is reached. Injected so tests never load pdf.js. */
export type PdfTextReader = (
  bytes: ArrayBuffer,
  limits: { maxPages: number; maxChars: number },
) => Promise<string>;

/** pdf.js is large: it loads on the first PDF attached, never before. */
const loadPdfReader = (): Promise<PdfTextReader> => import("./pdfText").then((m) => m.pdfText);

/** Read one file into a ChatDocument, or throw a DocumentReadError. A
 * password-protected or broken PDF is "empty": no text could be read. */
export async function readDocument(
  file: File,
  readPdf: () => Promise<PdfTextReader> = loadPdfReader,
): Promise<ChatDocument> {
  const kind = documentKindOf(file);
  if (!kind) throw new DocumentReadError("type");
  if (file.size > MAX_DOCUMENT_BYTES) throw new DocumentReadError("size");
  let raw: string;
  if (kind === "pdf") {
    try {
      const reader = await readPdf();
      raw = await reader(await file.arrayBuffer(), {
        maxPages: MAX_PDF_PAGES,
        // Headroom over the cap, since collapsing whitespace shortens it.
        maxChars: MAX_DOCUMENT_TEXT * 2,
      });
    } catch (e) {
      console.error("PDF read failed", e);
      throw new DocumentReadError("empty");
    }
  } else {
    raw = await file.text();
  }
  const text = cleanDocumentText(raw);
  if (text.length < MIN_DOCUMENT_CHARS) throw new DocumentReadError("empty");
  return { name: file.name, kind, text };
}
