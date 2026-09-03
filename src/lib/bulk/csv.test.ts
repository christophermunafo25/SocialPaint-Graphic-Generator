import { describe, expect, it } from "vitest";
import { parseCsv } from "./csv";

describe("parseCsv", () => {
  it("parses a plain comma file into headers and rows", () => {
    const out = parseCsv("name,role\nAda,Engineer\nGrace,Admiral\n");
    expect(out.headers).toEqual(["name", "role"]);
    expect(out.rows).toEqual([
      ["Ada", "Engineer"],
      ["Grace", "Admiral"],
    ]);
    expect(out.delimiter).toBe(",");
  });

  it("strips a UTF-8 BOM so the first header matches exactly", () => {
    const out = parseCsv("\uFEFFname,role\nAda,Engineer");
    expect(out.headers[0]).toBe("name");
  });

  it("treats CRLF, LF, and a missing trailing newline the same", () => {
    const crlf = parseCsv("name,role\r\nAda,Engineer\r\nGrace,Admiral\r\n");
    const lf = parseCsv("name,role\nAda,Engineer\nGrace,Admiral\n");
    const noTrail = parseCsv("name,role\nAda,Engineer\nGrace,Admiral");
    expect(crlf.rows).toEqual(lf.rows);
    expect(noTrail.rows).toEqual(lf.rows);
    expect(lf.rows).toHaveLength(2);
  });

  it("keeps a quoted delimiter inside the cell", () => {
    const out = parseCsv('name,city\n"Lovelace, Ada",London');
    expect(out.rows[0]).toEqual(["Lovelace, Ada", "London"]);
  });

  it("keeps a quoted newline inside the cell", () => {
    const out = parseCsv('name,bio\nAda,"First line\nSecond line"\nGrace,Short');
    expect(out.rows).toEqual([
      ["Ada", "First line\nSecond line"],
      ["Grace", "Short"],
    ]);
  });

  it("reads a doubled quote as one literal quote", () => {
    const out = parseCsv('name,quote\nAda,"She said ""hello"""');
    expect(out.rows[0]).toEqual(["Ada", 'She said "hello"']);
  });

  it("sniffs a tab delimiter", () => {
    const out = parseCsv("name\trole\nAda\tEngineer");
    expect(out.delimiter).toBe("\t");
    expect(out.headers).toEqual(["name", "role"]);
    expect(out.rows[0]).toEqual(["Ada", "Engineer"]);
  });

  it("sniffs a semicolon delimiter", () => {
    const out = parseCsv("name;role\nAda;Engineer");
    expect(out.delimiter).toBe(";");
    expect(out.rows[0]).toEqual(["Ada", "Engineer"]);
  });

  it("prefers comma on a tie", () => {
    const out = parseCsv("a,b;c\n1,2;3");
    expect(out.delimiter).toBe(",");
    expect(out.headers).toEqual(["a", "b;c"]);
  });

  it("does not count delimiters inside quoted header cells", () => {
    // Two semicolons outside quotes, three commas inside one quoted cell.
    const out = parseCsv('"a,b,c,d";e;f\n1;2;3');
    expect(out.delimiter).toBe(";");
    expect(out.headers).toEqual(["a,b,c,d", "e", "f"]);
  });

  it("truncates rows longer than the header", () => {
    const out = parseCsv("name,role\nAda,Engineer,extra,more");
    expect(out.rows[0]).toEqual(["Ada", "Engineer"]);
  });

  it("pads rows shorter than the header with empty strings", () => {
    const out = parseCsv("name,role,city\nAda");
    expect(out.rows[0]).toEqual(["Ada", "", ""]);
  });

  it("drops a completely empty row", () => {
    const out = parseCsv("name,role\nAda,Engineer\n\n,\n   ,  \nGrace,Admiral\n");
    expect(out.rows).toEqual([
      ["Ada", "Engineer"],
      ["Grace", "Admiral"],
    ]);
  });

  it("trims header cells but not data cells", () => {
    const out = parseCsv(" name , role \n Ada , Engineer ");
    expect(out.headers).toEqual(["name", "role"]);
    expect(out.rows[0]).toEqual([" Ada ", " Engineer "]);
  });

  it("throws a readable error when there is no header line", () => {
    expect(() => parseCsv("")).toThrow(/column headings/);
    expect(() => parseCsv("\n\n")).toThrow(/column headings/);
    expect(() => parseCsv("\uFEFF")).toThrow(/column headings/);
  });

  it("throws a readable error when there are no data rows", () => {
    expect(() => parseCsv("name,role")).toThrow(/no rows beneath/);
    expect(() => parseCsv("name,role\n")).toThrow(/no rows beneath/);
    expect(() => parseCsv("name,role\n\n,\n")).toThrow(/no rows beneath/);
  });

  it("handles a quoted field that ends the file without a newline", () => {
    const out = parseCsv('name,role\nAda,"Engineer"');
    expect(out.rows[0]).toEqual(["Ada", "Engineer"]);
  });
});
