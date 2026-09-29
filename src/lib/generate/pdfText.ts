// The PDF half of documentText.ts, in its own module so pdf.js (and its
// worker) load only when a member attaches their first PDF. The legacy
// build, since the modern one uses top-level await and built-ins the
// production target may not have (Template chat PROMPT §12.3).

import { GlobalWorkerOptions, getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import type { PdfTextReader } from "./documentText";

GlobalWorkerOptions.workerSrc = workerUrl;

/** The text of the first `maxPages` pages, items joined by spaces, stopping
 * early once `maxChars` is reached. Rejects for a password-protected or
 * unreadable file. */
export const pdfText: PdfTextReader = async (bytes, { maxPages, maxChars }) => {
  // Warnings off: a PDF on a standard font asks for font data it only
  // needs to draw, never to read its text.
  const task = getDocument({ data: new Uint8Array(bytes), verbosity: 0 });
  try {
    const doc = await task.promise;
    const parts: string[] = [];
    let length = 0;
    const pages = Math.min(doc.numPages, maxPages);
    for (let n = 1; n <= pages && length < maxChars; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      const text = content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
      parts.push(text);
      length += text.length;
      page.cleanup();
    }
    return parts.join(" ");
  } finally {
    await task.destroy();
  }
};
