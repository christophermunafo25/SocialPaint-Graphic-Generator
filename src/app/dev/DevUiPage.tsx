import React from "react";
import "./devUi.css";
import { BOARDS, BoardView } from "./Boards";
import { ComponentSheet } from "./ComponentSheet";

/** /dev/ui (development builds only): the six component type pages of the
 * Figma file "Master UX-UI New Brand Eleven Labs Inspired" rebuilt from the
 * primitives. One section a page, in the file's order and 1600 wide, each
 * component in every variant and state in its Light panel and again in its
 * Dark panel. Each board pins its own themes, so it reads the same whatever
 * theme the app is in.
 *
 * The working sheet follows: the keyboard ring on every control, live
 * controls to click and Tab through, and the Product components. */
export function DevUiPage() {
  return (
    <div className="dev-ui">
      {BOARDS.map((board) => (
        <BoardView key={board.node} board={board} />
      ))}
      <ComponentSheet />
    </div>
  );
}
