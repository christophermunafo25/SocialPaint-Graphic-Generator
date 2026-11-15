import { describe, expect, it } from "vitest";
import type { FigmaNode } from "../../../supabase/functions/_shared/extract.ts";
import { importFrame } from "../../../supabase/functions/_shared/importFrame.ts";
import { makeMemberField } from "../../../supabase/functions/_shared/frameIntent.ts";
import { portraitWithPlate } from "../../../supabase/functions/_shared/intentFixtures.ts";
import {
  editsBefore,
  renameToDefaults,
  scoreRoute,
  truthFromKeys,
  truthFromList,
} from "./importEval";

const names = (root: FigmaNode): string[] => {
  const out: string[] = [];
  const visit = (n: FigmaNode) => {
    for (const c of n.children ?? []) {
      out.push(c.name);
      visit(c);
    }
  };
  visit(root);
  return out;
};

/** The keyed frame, the same frame unkeyed, and the truth its keys give. */
function frames() {
  const keyedRoot = portraitWithPlate();
  const keyed = importFrame(keyedRoot);
  const unkeyed = importFrame(renameToDefaults(keyedRoot));
  const truth = truthFromKeys(keyed.fields, keyed.intents);
  const defaultLabels = new Map(unkeyed.fields.map((f) => [f.sourceNodeId, f.label]));
  const bySource = (id: string) => unkeyed.fields.find((f) => f.sourceNodeId === id)!;
  return { keyedRoot, keyed, unkeyed, truth, defaultLabels, bySource };
}

describe("renameToDefaults", () => {
  it("names every layer as Figma would, and leaves the frame's own name", () => {
    const root = portraitWithPlate();
    const renamed = renameToDefaults(root);
    expect(renamed.name).toBe(root.name);
    expect(names(renamed)).toEqual([
      "Mask group",
      "Rectangle 1",
      "image 1",
      "Frame 1",
      "Group 1",
      "Is it time to drop the naps?",
      "Frame 2",
      "Frame 3",
      "Read the answer",
      "image 2",
    ]);
    // A copy: the keyed frame still reads as keyed.
    expect(names(root)[2]).toBe("photo-fill · image · fit=cover · edit=member");
  });

  it("leaves nothing for the importer to read as a key", () => {
    const { unkeyed } = frames();
    expect(unkeyed.intents).toEqual([]);
    expect(unkeyed.parse.keyed).toBe(0);
    expect(unkeyed.fields.every((f) => f.static === true)).toBe(true);
  });
});

describe("truthFromKeys", () => {
  it("reads what each keyed layer says its field should be", () => {
    expect(frames().truth).toEqual([
      { sourceNodeId: "32:40", label: "Photo", member: true },
      { sourceNodeId: "33:16", label: "Plate", member: false },
      { sourceNodeId: "33:18", label: "Headline", member: true, max: 32 },
      { sourceNodeId: "40:2", label: "Call to action", member: true, max: 24 },
      { sourceNodeId: "33:19", label: "Logo", member: false },
    ]);
  });

  it("has no answer for a layer that doesn't state edit", () => {
    const keyed = importFrame(
      portraitWithPlate({ names: { logo: "logo · logo · variant=primary", plate: "Frame 7" } }),
    );
    const truth = truthFromKeys(keyed.fields, keyed.intents);
    expect(truth.map((t) => t.label)).toEqual(["Photo", "Headline", "Call to action"]);
  });
});

describe("scoreRoute", () => {
  it("asks only for a caption when a keyed frame lands on its keys", () => {
    const { keyed, truth } = frames();
    expect(scoreRoute({ truth, fields: keyed.fields })).toMatchObject({
      fixed: 0,
      labels: 0,
      caption: 1,
      total: 1,
    });
    expect(scoreRoute({ truth, fields: keyed.fields, caption: "{headline}" }).total).toBe(0);
  });

  it("counts Fixed, a label and the caption for every member an unkeyed frame lands fixed", () => {
    const { unkeyed, truth, defaultLabels } = frames();
    const score = scoreRoute({ truth, fields: unkeyed.fields, defaultLabels });
    expect(score).toMatchObject({ fixed: 3, labels: 3, caption: 1, total: 7, missing: [] });
    expect(score.wrong).toEqual([
      { label: "Mask group", landed: "fixed" },
      { label: "Is it time to drop the naps?", landed: "fixed" },
      { label: "Frame 3", landed: "fixed" },
    ]);
  });

  it("scores a model's guesses against the keys", () => {
    const { unkeyed, truth, defaultLabels, bySource } = frames();
    // The model opens the headline and the photo and names them, leaves the
    // pill fixed, and wrongly opens the logo.
    for (const [id, label] of [
      ["33:18", "Question"],
      ["32:40", "Photo"],
      ["33:19", "Clinic logo"],
    ]) {
      const field = bySource(id);
      makeMemberField(field);
      field.label = label;
    }
    const score = scoreRoute({
      truth,
      fields: unkeyed.fields,
      defaultLabels,
      caption: "{question}",
    });
    expect(score.wrong).toEqual([
      { label: "Frame 3", landed: "fixed" },
      { label: "Clinic logo", landed: "member" },
    ]);
    // The pill still needs Fixed off and a label of its own.
    expect(score).toMatchObject({ fixed: 2, labels: 1, caption: 0, total: 3 });
  });

  it("counts a field the import never landed", () => {
    const { keyed, truth } = frames();
    const score = scoreRoute({
      truth,
      fields: keyed.fields.filter((f) => f.label !== "Headline"),
      caption: "x",
    });
    expect(score.missing).toEqual(["Headline"]);
    expect(score.total).toBe(1);
  });

  it("asks for no caption when nothing is a member field", () => {
    const { keyed } = frames();
    const truth = [{ sourceNodeId: "33:16", label: "Plate", member: false }];
    expect(scoreRoute({ truth, fields: keyed.fields }).total).toBe(0);
  });
});

describe("truthFromList", () => {
  it("makes the listed layers members and every other text or image fixed", () => {
    const { unkeyed } = frames();
    const { truth, unknown } = truthFromList(unkeyed.fields, ["33:18", "32:40", "9:9"]);
    expect(truth).toEqual([
      { sourceNodeId: "32:40", label: "Mask group", member: true },
      { sourceNodeId: "33:18", label: "Is it time to drop the naps?", member: true },
      { sourceNodeId: "40:2", label: "Frame 3", member: false },
      { sourceNodeId: "33:19", label: "image 2", member: false },
    ]);
    // The plate is a shape: nothing a member could fill in, so no answer.
    expect(unknown).toEqual(["9:9"]);
  });
});

describe("editsBefore", () => {
  it("is Fixed, a label and any limit per member, then a name and a caption", () => {
    // Three members, two with a limit: 3 x 2 + 2, then name and caption.
    expect(editsBefore(frames().truth)).toBe(10);
    expect(editsBefore([{ sourceNodeId: "a", label: "A", member: false }])).toBe(1);
  });
});
