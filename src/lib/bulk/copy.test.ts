import { describe, expect, it } from "vitest";
import { overCapLine, problemSentence, readyLine, rowStatus } from "./copy";

describe("problemSentence", () => {
  it("names the field and what to do for each kind", () => {
    expect(problemSentence({ kind: "missing_required", fieldKey: "name", label: "Name" })).toBe(
      "Name is empty and the template requires it.",
    );
    expect(
      problemSentence({ kind: "too_long", fieldKey: "name", label: "Name", max: 20, actual: 26 }),
    ).toBe("Name is 26 characters and the limit is 20.");
    expect(
      problemSentence({
        kind: "not_an_option",
        fieldKey: "city",
        label: "City",
        options: ["Chicago", "New York"],
      }),
    ).toBe("City must be one of Chicago, New York.");
    expect(
      problemSentence({ kind: "overflows", fieldKey: "h", label: "Headline", characterBudget: 34 }),
    ).toBe(
      "More text than the Headline box holds. Shorten it to about 34 characters, or include it anyway and the text will run past the edge.",
    );
  });

  it("drops the character count when the budget is zero or absent", () => {
    const text = problemSentence({ kind: "overflows", fieldKey: "h", label: "Headline" });
    expect(text).toBe(
      "More text than the Headline box holds. Shorten it, or include it anyway and the text will run past the edge.",
    );
    expect(
      problemSentence({ kind: "overflows", fieldKey: "h", label: "Headline", characterBudget: 0 }),
    ).toBe(text);
  });

  it("never uses an exclamation point", () => {
    const all = [
      problemSentence({ kind: "missing_required", fieldKey: "n", label: "Name" }),
      problemSentence({ kind: "too_long", fieldKey: "n", label: "Name", max: 1, actual: 2 }),
      problemSentence({ kind: "not_an_option", fieldKey: "c", label: "City", options: ["A"] }),
      problemSentence({ kind: "overflows", fieldKey: "h", label: "Headline", characterBudget: 3 }),
      readyLine(1, 2),
      overCapLine(240, 200),
    ];
    for (const s of all) expect(s).not.toContain("!");
  });
});

describe("rowStatus", () => {
  it("is Ready with no problems and joins problems in order", () => {
    expect(rowStatus([])).toBe("Ready");
    expect(
      rowStatus([
        { kind: "missing_required", fieldKey: "n", label: "Name" },
        { kind: "too_long", fieldKey: "h", label: "Headline", max: 5, actual: 9 },
      ]),
    ).toBe(
      "Name is empty and the template requires it. Headline is 9 characters and the limit is 5.",
    );
  });
});

describe("readyLine and overCapLine", () => {
  it("counts rows in plain words", () => {
    expect(readyLine(38, 40)).toBe("38 of 40 rows are ready.");
    expect(readyLine(1, 40)).toBe("1 of 40 rows is ready.");
    expect(readyLine(40, 40)).toBe("All 40 rows are ready.");
    expect(readyLine(1, 1)).toBe("The row is ready.");
    expect(readyLine(0, 1)).toBe("0 of 1 row are ready.");
    expect(overCapLine(240, 200)).toBe(
      "This file has 240 rows. Bulk fill renders up to 200 at a time, so split the file and run it in parts.",
    );
  });
});
