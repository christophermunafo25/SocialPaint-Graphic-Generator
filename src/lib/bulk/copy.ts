// The sentences the review table shows for a row's problems. Kept out of
// the page so the words are tested, and so the same problem reads the same
// wherever it is surfaced. Every sentence says what is wrong and what to
// do about it, in second person, with no exclamation.

import type { RowProblem } from "./validate";

/** One problem as one or two plain sentences. */
export function problemSentence(p: RowProblem): string {
  switch (p.kind) {
    case "missing_required":
      return `${p.label} is empty and the template requires it.`;
    case "too_long":
      return `${p.label} is ${p.actual} characters and the limit is ${p.max}.`;
    case "not_an_option":
      return `${p.label} must be one of ${p.options.join(", ")}.`;
    case "overflows":
      return p.characterBudget
        ? `More text than the ${p.label} box holds. Shorten it to about ${p.characterBudget} characters, or include it anyway and the text will run past the edge.`
        : `More text than the ${p.label} box holds. Shorten it, or include it anyway and the text will run past the edge.`;
  }
}

/** A row's status cell: "Ready", or every problem in check order. */
export function rowStatus(problems: RowProblem[]): string {
  return problems.length === 0 ? "Ready" : problems.map(problemSentence).join(" ");
}

/** "38 of 40 rows are ready." */
export function readyLine(ready: number, total: number): string {
  const rows = total === 1 ? "row" : "rows";
  if (ready === total) return total === 1 ? "The row is ready." : `All ${total} rows are ready.`;
  return `${ready} of ${total} ${rows} ${ready === 1 ? "is" : "are"} ready.`;
}

/** The cap refusal: names the count and what to do. */
export function overCapLine(count: number, cap: number): string {
  return `This file has ${count} rows. Bulk fill renders up to ${cap} at a time, so split the file and run it in parts.`;
}
