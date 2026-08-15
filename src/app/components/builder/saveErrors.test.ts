import { describe, expect, it } from "vitest";
import { saveErrorMessage } from "./TemplateBuilder";

describe("saveErrorMessage", () => {
  it("names a schema mismatch as a pending migration, not a retry", () => {
    // The exact shape Postgres returns for the bug this was written for.
    const msg = saveErrorMessage(
      new Error(
        'new row for relation "template_fields" violates check constraint "template_fields_text_sizing_check"',
      ),
    );
    expect(msg).toMatch(/migration is probably pending/i);
    expect(msg).toMatch(/nothing was saved/i);
    // The raw text survives — it is the only clue when the cause is novel.
    expect(msg).toContain("template_fields_text_sizing_check");
  });

  it("treats an enum rejection the same way", () => {
    const msg = saveErrorMessage(new Error('invalid input value for enum field_type: "widget"'));
    expect(msg).toMatch(/migration is probably pending/i);
  });

  it("explains a permissions failure", () => {
    const msg = saveErrorMessage(
      new Error('new row violates row-level security policy for table "templates"'),
    );
    expect(msg).toMatch(/permission/i);
  });

  it("reassures on a network failure — the work is not lost", () => {
    const msg = saveErrorMessage(new TypeError("Failed to fetch"));
    expect(msg).toMatch(/connection/i);
    expect(msg).toMatch(/still here/i);
  });

  it("falls back to the raw text for anything unrecognised", () => {
    expect(saveErrorMessage(new Error("kaboom"))).toContain("kaboom");
    expect(saveErrorMessage("a bare string")).toContain("a bare string");
  });
});
