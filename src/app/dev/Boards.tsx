import React from "react";
import data from "./boards.json";
import { SPECIMENS, type Variant } from "./specimens";

/** One variant on a board: the value of each variant property joined by a
 * bar, where the file places it inside its set (x, y), the size the file
 * draws it (w, h), and its sample texts joined by a broken bar. */
type Item = [values: string, x: number, y: number, w: number, h: number, text: string];

interface SetPart {
  kind: "set";
  /** The component set's node id in the file. */
  node: string;
  name: string;
  w: number;
  h: number;
  /** The variant properties, in the order `values` lists them. */
  keys: string[];
  items: Item[];
  /** The file draws no box around this set (Search Field). */
  plain?: boolean;
}
interface CompPart {
  kind: "comp";
  node: string;
  name: string;
  w: number;
  h: number;
  text: string;
}
interface RowPart {
  kind: "row";
  gap: number;
  parts: Array<SetPart | CompPart>;
}
type Part = SetPart | CompPart | RowPart;

interface Block {
  name: string;
  note: string;
  parts: Part[];
}

export interface Board {
  name: string;
  /** The type page's node id in the file ("Components · Actions" is
   * 6218:2). */
  node: string;
  /** Unused since the boards follow the type pages; kept as 0. */
  height: number;
  eyebrow: string;
  title: string;
  description: string;
  blocks: Block[];
}

/** The six component type pages (Actions, Inputs, Selection, Labels and
 * feedback, Navigation, Containers) of the Figma file "Master UX-UI New
 * Brand Eleven Labs Inspired" (dQ8bQq3V7Bue5pvFrI2g9X), one board each.
 * boards.json is data from the file: each component set's variants where
 * the set places them, their sample texts, and each component's
 * description, read on 2026-11-17. */
export const BOARDS = data as unknown as Board[];

const texts = (text: string): string[] => (text === "" ? [] : text.split(" ¦ "));

function variantOf(keys: string[], values: string, text: string): Variant {
  const parts = values.split("|");
  return {
    values: Object.fromEntries(keys.map((key, i) => [key, parts[i]])),
    texts: texts(text),
  };
}

/** A component set as its board draws it: every variant at its place. In
 * Light the set sits in the file's dashed box. */
function SetView({ part, boxed }: { part: SetPart; boxed: boolean }) {
  const specimen = SPECIMENS[part.name];
  return (
    <div
      className="dev-board__set"
      data-boxed={boxed && !part.plain ? "" : undefined}
      style={{ width: part.w, height: part.h }}
    >
      {part.items.map(([values, x, y, w, , text]) => (
        <div
          key={values}
          className="dev-board__cell"
          data-fill={specimen?.fill ? "" : undefined}
          style={{ left: x, top: y, width: w }}
        >
          {specimen?.render(variantOf(part.keys, values, text))}
        </div>
      ))}
    </div>
  );
}

/** A component that is not a set: one drawing, with no box around it. */
function CompView({ part }: { part: CompPart }) {
  const specimen = SPECIMENS[part.name];
  return (
    <div
      className="dev-board__comp"
      data-fill={specimen?.fill ? "" : undefined}
      style={{ width: part.w }}
    >
      {specimen?.render({ values: {}, texts: texts(part.text) })}
    </div>
  );
}

function PartView({ part, boxed }: { part: Part; boxed: boolean }) {
  if (part.kind === "set") return <SetView part={part} boxed={boxed} />;
  if (part.kind === "comp") return <CompView part={part} />;
  return (
    <div className="dev-board__row" style={{ gap: part.gap }}>
      {part.parts.map((p) => (
        <PartView key={p.node} part={p} boxed={boxed} />
      ))}
    </div>
  );
}

const partKey = (part: Part): string => (part.kind === "row" ? "row" : part.node);

/** A component's block: its name and the file's description of it, then
 * the component in its Light panel and again in its Dark panel, as each
 * board on the file's type pages draws it. A block that is one set shows
 * that set in a frame; anything else sits 24 inside its frame. Each panel
 * carries data-panel and the block data-component, so the shots script can
 * save every panel as its own image. */
function BlockView({ block }: { block: Block }) {
  const oneSet = block.parts.length === 1 && block.parts[0].kind === "set";
  return (
    <div className="dev-board__block" data-component={slug(block.name)}>
      <h3 className="t-title-card">{block.name}</h3>
      <p className="t-body-m dev-board__note">{block.note}</p>
      <span className="t-mono-eyebrow dev-board__quiet">Light</span>
      <div className="dev-board__light" data-panel="light">
        {block.parts.map((part) => (
          <PartView key={partKey(part)} part={part} boxed />
        ))}
      </div>
      <span className="t-mono-eyebrow dev-board__quiet">Dark</span>
      <div
        className="dev-board__dark"
        data-theme="dark"
        data-panel="dark"
        data-padded={oneSet ? undefined : ""}
      >
        {block.parts.map((part) => (
          <PartView key={partKey(part)} part={part} boxed={false} />
        ))}
      </div>
    </div>
  );
}

/** A component's name as a file name ("Icon Button" is icon-button). */
export const slug = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

/** One type page of the file, 1600 wide like the file's boards: the
 * section header, then a block for each component in the page's order. */
export function BoardView({ board }: { board: Board }) {
  return (
    <section
      className="dev-board"
      data-theme="light"
      data-board={slug(board.name)}
      aria-label={board.name}
    >
      <div className="dev-board__inner">
        <header className="dev-board__header">
          <p className="t-mono-eyebrow dev-board__quiet">{board.eyebrow}</p>
          <h2 className="t-title-section">{board.title}</h2>
          <p className="t-body-m dev-board__quiet">{board.description}</p>
        </header>
        {board.blocks.map((block) => (
          <BlockView key={block.name} block={block} />
        ))}
      </div>
    </section>
  );
}
