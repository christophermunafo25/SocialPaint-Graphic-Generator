import { render } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import { BOARDS, BoardView } from "./Boards";
import { SPECIMENS } from "./specimens";
import { ThemesPanels } from "./ThemesPanels";

const parts = BOARDS.flatMap((board) =>
  board.blocks.flatMap((block) =>
    block.parts.flatMap((part) => (part.kind === "row" ? part.parts : [part])),
  ),
);

describe("The boards of /dev/ui", () => {
  it("follow the Components page's order", () => {
    expect(BOARDS.map((b) => b.name)).toEqual([
      "Buttons",
      "Fields",
      "Selection",
      "Labels",
      "Avatars",
      "Navigation",
      "Containers",
      "Themes",
    ]);
  });

  it("have a specimen for every component the file draws", () => {
    const missing = parts.map((p) => p.name).filter((name) => !SPECIMENS[name]);
    expect(missing).toEqual([]);
  });

  it("name one value for each variant property", () => {
    for (const part of parts) {
      if (part.kind !== "set") continue;
      for (const [values] of part.items) {
        expect(values.split("|").length, `${part.name}: ${values}`).toBe(part.keys.length);
      }
    }
  });

  it("draw every variant twice: in Light and in its Dark preview", () => {
    for (const board of BOARDS) {
      const { container, unmount } = render(
        <BoardView board={board}>{board.name === "Themes" && <ThemesPanels />}</BoardView>,
      );
      const variants = board.blocks
        .flatMap((block) =>
          block.parts.flatMap((part) => (part.kind === "row" ? part.parts : [part])),
        )
        .reduce((n, part) => n + (part.kind === "set" ? part.items.length : 0), 0);
      const cells = container.querySelectorAll(".dev-board__cell");
      expect(cells.length, board.name).toBe(variants * 2);
      // No cell is left empty by a variant its specimen does not know.
      for (const cell of cells) expect(cell.childElementCount, board.name).toBeGreaterThan(0);
      expect(container.querySelectorAll('.dev-board__dark[data-theme="dark"]').length).toBe(
        board.blocks.length,
      );
      unmount();
    }
  });
});
