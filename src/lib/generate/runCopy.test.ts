import { describe, expect, it } from "vitest";
import * as copy from "./runCopy";
import {
  DONE_FALLBACK,
  GENERATE_FAILED,
  NEW_CHAT_TITLE,
  NOTHING_FIT,
  STEP_CHECKING,
  STEP_READING,
  STOPPED_STATUS,
  askingCopy,
  fillingStatus,
  joinNames,
  layingOutStatus,
  measuringCopy,
  measuringStepLabel,
  overflowingDesignWarning,
  progressLabel,
  provenanceSentence,
  unavailableWarning,
  unfittableDraftWarning,
  type ProposalShape,
} from "./runCopy";

const portrait = { width: 1080, height: 1350 };
const landscape = { width: 1200, height: 627 };
const square = { width: 1080, height: 1080 };
const shape = (templateName: string, canvas: ProposalShape["canvas"]): ProposalShape => ({
  templateName,
  canvas,
});

describe("step 1, asking", () => {
  it("reads the brief, in each mode's words", () => {
    expect(askingCopy("library")).toEqual({
      stepLabel: "Reading your brief",
      status: "Reading your brief and choosing from your templates.",
    });
    expect(askingCopy("freestyle")).toEqual({
      stepLabel: "Reading your brief",
      status: "Designing new layouts from your brand kit.",
    });
    expect(STEP_READING).toBe("Reading your brief");
  });
});

describe("step 2, measuring", () => {
  it("labels the step by the distinct canvas sizes the proposals span", () => {
    expect(measuringStepLabel([shape("A", portrait)])).toBe("Rendering your draft");
    expect(measuringStepLabel([shape("A", portrait), shape("B", landscape)])).toBe(
      "Rendering both sizes",
    );
    expect(
      measuringStepLabel([shape("A", portrait), shape("B", landscape), shape("C", square)]),
    ).toBe("Rendering 3 sizes");
  });

  it("counts sizes, not proposals", () => {
    expect(measuringStepLabel([shape("A", portrait), shape("B", portrait)])).toBe(
      "Rendering your draft",
    );
    expect(
      measuringStepLabel([shape("A", portrait), shape("B", landscape), shape("C", portrait)]),
    ).toBe("Rendering both sizes");
  });

  it("counts a proposal of unknown size as a size of its own", () => {
    expect(measuringStepLabel([shape("A", null)])).toBe("Rendering your draft");
    expect(measuringStepLabel([shape("A", portrait), shape("B", null)])).toBe(
      "Rendering both sizes",
    );
    expect(measuringStepLabel([shape("A", null), shape("B", null), shape("C", null)])).toBe(
      "Rendering 3 sizes",
    );
  });

  it("joins names with 'and', and three or more with the Oxford comma", () => {
    expect(joinNames([])).toBe("");
    expect(joinNames(["Now hiring"])).toBe("Now hiring");
    expect(joinNames(["Now hiring", "Open role"])).toBe("Now hiring and Open role");
    expect(joinNames(["Now hiring", "Open role", "Team spotlight"])).toBe(
      "Now hiring, Open role, and Team spotlight",
    );
    expect(joinNames(["A", "B", "C", "D"])).toBe("A, B, C, and D");
  });

  it("names the templates being filled, once each, in proposal order", () => {
    expect(fillingStatus(["Now hiring"])).toBe("Filling in your Now hiring template.");
    expect(fillingStatus(["Now hiring", "Open role"])).toBe(
      "Filling in your Now hiring and Open role templates.",
    );
    expect(fillingStatus(["Now hiring", "Open role", "Team spotlight"])).toBe(
      "Filling in your Now hiring, Open role, and Team spotlight templates.",
    );
    // The same template twice is still one template.
    expect(fillingStatus(["Now hiring", "Now hiring"])).toBe(
      "Filling in your Now hiring template.",
    );
    expect(fillingStatus(["Open role", "Now hiring", "Open role"])).toBe(
      "Filling in your Open role and Now hiring templates.",
    );
    expect(fillingStatus(["", "  "])).toBe("Filling in your templates.");
  });

  it("counts the new designs in freestyle", () => {
    expect(layingOutStatus(1)).toBe("Laying out 1 new design.");
    expect(layingOutStatus(2)).toBe("Laying out 2 new designs.");
    expect(layingOutStatus(3)).toBe("Laying out 3 new designs.");
  });

  it("puts label and status together per mode", () => {
    const proposals = [shape("Now hiring", portrait), shape("Open role", landscape)];
    expect(measuringCopy("library", proposals)).toEqual({
      stepLabel: "Rendering both sizes",
      status: "Filling in your Now hiring and Open role templates.",
    });
    expect(measuringCopy("freestyle", proposals)).toEqual({
      stepLabel: "Rendering both sizes",
      status: "Laying out 2 new designs.",
    });
  });
});

describe("step 3 and the finished turn", () => {
  it("says what each state says", () => {
    expect(STEP_CHECKING).toBe("Checking every line fits");
    expect(DONE_FALLBACK).toBe("Here you go, with a caption for each draft.");
    expect(STOPPED_STATUS).toBe("Stopped. The drafts that finished are below.");
    expect(NOTHING_FIT).toBe(
      "None of the drafts fit their templates. Try a shorter brief, or fill a template directly. The library is unaffected.",
    );
    expect(GENERATE_FAILED).toBe("Generate failed. Try again.");
    expect(NEW_CHAT_TITLE).toBe("New chat");
  });

  it("formats the progress label as the frame does", () => {
    expect(progressLabel(2, "Rendering both sizes")).toBe("2 of 3 · Rendering both sizes");
    expect(progressLabel(1, STEP_READING)).toBe("1 of 3 · Reading your brief");
    expect(progressLabel(3, STEP_CHECKING)).toBe("3 of 3 · Checking every line fits");
  });
});

describe("dropped-proposal warnings", () => {
  it("keeps the old page's strings verbatim", () => {
    expect(overflowingDesignWarning("Bold launch")).toBe(
      'Dropped the "Bold launch" design because its copy overflows.',
    );
    expect(unavailableWarning("Now hiring")).toBe(
      '"Now hiring" is no longer available and was skipped.',
    );
    expect(unfittableDraftWarning("Now hiring")).toBe(
      'Dropped a "Now hiring" draft because its copy couldn\'t be made to fit the design.',
    );
  });
});

describe("provenanceSentence", () => {
  it("names the model and the library it drew from", () => {
    expect(provenanceSentence({ model: "claude-x", candidateCount: 12, mode: "library" })).toBe(
      "Drafted by claude-x from 12 published templates.",
    );
    expect(provenanceSentence({ model: "claude-x", candidateCount: 1, mode: "library" })).toBe(
      "Drafted by claude-x from the template you picked.",
    );
    expect(provenanceSentence({ model: "claude-x", candidateCount: 5, mode: "freestyle" })).toBe(
      "Drafted by claude-x from your brand kit, with 5 published templates as reference.",
    );
    expect(provenanceSentence({ model: "claude-x", candidateCount: 1, mode: "freestyle" })).toBe(
      "Drafted by claude-x from your brand kit, with 1 published template as reference.",
    );
    expect(provenanceSentence({ model: "claude-x", candidateCount: 0, mode: "freestyle" })).toBe(
      "Drafted by claude-x from your brand kit.",
    );
  });
});

describe("the copy as a whole", () => {
  it("never uses an em dash", () => {
    const strings: string[] = [];
    for (const value of Object.values(copy)) {
      if (typeof value === "string") strings.push(value);
    }
    const shapes = [shape("A", portrait), shape("B", landscape), shape("C", square)];
    strings.push(
      askingCopy("library").status,
      askingCopy("freestyle").status,
      measuringCopy("library", shapes).status,
      measuringCopy("freestyle", shapes).status,
      measuringCopy("library", shapes).stepLabel,
      progressLabel(2, "Rendering both sizes"),
      overflowingDesignWarning("A"),
      unavailableWarning("A"),
      unfittableDraftWarning("A"),
      provenanceSentence({ model: "m", candidateCount: 3, mode: "freestyle" }),
    );
    for (const s of strings) expect(s).not.toContain("—");
  });
});
