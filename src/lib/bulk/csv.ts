// The CSV reader behind bulk fill: one spreadsheet export in, a header row
// and a grid of strings out.
//
// Deliberately dependency-free. The subset of RFC 4180 that real spreadsheet
// exports produce (quoted fields, doubled quotes, embedded newlines, a BOM,
// CRLF) is short enough to own outright, and owning it means the failure
// modes are ours to describe to the person rather than a library's.
//
// Lines are never split with a regex. Quoted fields can contain the
// delimiter and the newline, so the only correct reader is a character
// walk carrying a "am I inside quotes" flag — that is what this is.

export interface ParsedCsv {
  /** Trimmed header cells, in file order. */
  headers: string[];
  /** One entry per data row, same length as headers (short rows padded with ""). */
  rows: string[][];
  /** The delimiter that was detected, for the UI to state. */
  delimiter: "," | "\t" | ";";
}

export type CsvDelimiter = ParsedCsv["delimiter"];

/** Comma first: a tie between candidates resolves to the one nearly every
 * export uses. Tab and semicolon exist because Excel in a European locale
 * writes semicolons and a copied Google Sheets selection pastes as tabs. */
const DELIMITERS: readonly CsvDelimiter[] = [",", "\t", ";"];

/** Pick the delimiter by counting each candidate on the header line, outside
 * quotes. The header is the one line guaranteed to contain every column
 * separator and nothing that looks like one inside a value. */
function sniffDelimiter(headerLine: string): CsvDelimiter {
  const counts = new Map<CsvDelimiter, number>(DELIMITERS.map((d) => [d, 0]));
  let inQuotes = false;
  for (const ch of headerLine) {
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (inQuotes) continue;
    const n = counts.get(ch as CsvDelimiter);
    if (n !== undefined) counts.set(ch as CsvDelimiter, n + 1);
  }
  let best: CsvDelimiter = ",";
  let bestCount = -1;
  // Strictly greater, so the earlier candidate (comma) wins a tie.
  for (const d of DELIMITERS) {
    const n = counts.get(d) ?? 0;
    if (n > bestCount) {
      best = d;
      bestCount = n;
    }
  }
  return best;
}

/** The first line of the file, before any newline outside quotes. Used only
 * to sniff the delimiter, so quotes are tracked but not interpreted. */
function firstLine(text: string): string {
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && (ch === "\n" || ch === "\r")) return text.slice(0, i);
  }
  return text;
}

/** Walk the text once and produce every record as an array of raw cells.
 * A quote toggles quoted mode; inside it, a doubled quote is a literal
 * quote and delimiters and newlines are ordinary characters. */
function readRecords(text: string, delimiter: CsvDelimiter): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let cell = "";
  let inQuotes = false;
  let i = 0;

  const endRecord = () => {
    record.push(cell);
    records.push(record);
    record = [];
    cell = "";
  };

  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      cell += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === delimiter) {
      record.push(cell);
      cell = "";
      i++;
      continue;
    }
    if (ch === "\r") {
      // CRLF is one line ending; a bare CR is treated as one too.
      endRecord();
      i += text[i + 1] === "\n" ? 2 : 1;
      continue;
    }
    if (ch === "\n") {
      endRecord();
      i++;
      continue;
    }
    cell += ch;
    i++;
  }
  // The last record when the file has no trailing newline. A file that ends
  // in a newline leaves nothing pending, which is why an empty trailing
  // record never appears.
  if (cell !== "" || record.length > 0) endRecord();
  return records;
}

const isBlankRecord = (record: string[]): boolean => record.every((c) => c.trim() === "");

/** Parse a spreadsheet export. Throws a plain Error, written for the person
 * who dropped the file, when there is no header line or no data row. */
export function parseCsv(text: string): ParsedCsv {
  // A UTF-8 BOM is invisible in a spreadsheet and would otherwise become
  // part of the first header, defeating the exact-key match.
  const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  const header = firstLine(body);
  if (header.trim() === "") {
    throw new Error("The file is empty. The first line needs to be the column headings.");
  }
  const delimiter = sniffDelimiter(header);
  const records = readRecords(body, delimiter).filter((r) => !isBlankRecord(r));

  const headers = (records[0] ?? []).map((h) => h.trim());
  if (headers.length === 0 || headers.every((h) => h === "")) {
    throw new Error("The file is empty. The first line needs to be the column headings.");
  }
  const width = headers.length;
  const rows = records.slice(1).map((r) => {
    // Longer rows lose their extra cells and shorter ones are padded. A
    // spreadsheet with a stray value past the last heading, or a row that
    // trails off early, is ordinary and not a reason to refuse the file.
    const out = r.slice(0, width);
    while (out.length < width) out.push("");
    return out;
  });
  if (rows.length === 0) {
    throw new Error("The file has column headings but no rows beneath them.");
  }
  return { headers, rows, delimiter };
}
