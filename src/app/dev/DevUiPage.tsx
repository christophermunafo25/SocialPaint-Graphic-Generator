import React from "react";
import "./devUi.css";
import { BOARDS, BoardView } from "./Boards";
import { ComponentSheet } from "./ComponentSheet";
import { ThemesPanels } from "./ThemesPanels";

/** /dev/ui (development builds only): the Components page (4012:1193) of
 * the Figma file "Master UX UI New Brand (Copy)" rebuilt from the
 * primitives. One section a board, in the page's order and 1600 wide like
 * the file's, every component in every variant and state, in Light with a
 * Dark preview under it. Each board pins its own themes, so it reads the
 * same whatever theme the app is in.
 *
 * The working sheet follows: the keyboard ring on every control, live
 * controls to click and Tab through, and the Product components. */
export function DevUiPage() {
  return (
    <div className="dev-ui">
      {BOARDS.map((board) => (
        <BoardView key={board.node} board={board}>
          {board.name === "Themes" && <ThemesPanels />}
        </BoardView>
      ))}
      <ComponentSheet />
    </div>
  );
}
