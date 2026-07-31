import React from "react";
import {
  AlignLeft,
  ChevronDown,
  Circle,
  Image as ImageIcon,
  Minus,
  Square,
  Star,
  Triangle,
  Type as TypeIcon,
} from "lucide-react";
import { PALETTE_ITEMS, PALETTE_MIME, type PaletteItem } from "./fieldOps";

const ICONS: Record<string, React.ComponentType<{ style?: React.CSSProperties }>> = {
  text: TypeIcon,
  multiline: AlignLeft,
  image: ImageIcon,
  select: ChevronDown,
  rect: Square,
  ellipse: Circle,
  triangle: Triangle,
  star: Star,
  line: Minus,
};

interface ElementPaletteProps {
  /** Click fallback: adds the element at the canvas center. */
  onAdd(paletteId: string): void;
}

function Tile({ item, onAdd }: { item: PaletteItem; onAdd(id: string): void }) {
  const Icon = ICONS[item.id] ?? Square;
  return (
    <button
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(PALETTE_MIME, item.id);
        e.dataTransfer.effectAllowed = "copy";
      }}
      onClick={() => onAdd(item.id)}
      title="Drag onto the canvas, or click to add at the center"
      className="flex flex-col items-center gap-1.5 py-3 px-2 transition-colors"
      style={{
        border: "1px solid var(--border-strong)",
        borderRadius: "var(--radius-card-sm, 10px)",
        background: "var(--bg-surface)",
        cursor: "grab",
        fontSize: 11,
        color: "var(--text-secondary)",
      }}
    >
      <Icon style={{ width: 16, height: 16, color: "var(--state-primary)" }} />
      {item.label}
    </button>
  );
}

/** The Fields step's element palette: member-editable fields, then
 * decorative shapes (always fixed on the graphic). Drag a tile onto the
 * canvas to drop it where it lands; clicking adds at the center. */
export function ElementPalette({ onAdd }: ElementPaletteProps) {
  const fields = PALETTE_ITEMS.filter((i) => i.group === "fields");
  const shapes = PALETTE_ITEMS.filter((i) => i.group === "shapes");
  return (
    <div className="sp-card p-3 space-y-3">
      <div className="space-y-2">
        <h3 className="sp-eyebrow">Fields</h3>
        {/* When the builder stacks to one column (below lg), the palette spans
            the full content width — four-across keeps the tiles hand-sized. */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-2">
          {fields.map((item) => (
            <Tile key={item.id} item={item} onAdd={onAdd} />
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <h3 className="sp-eyebrow">Shapes</h3>
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-3 gap-2">
          {shapes.map((item) => (
            <Tile key={item.id} item={item} onAdd={onAdd} />
          ))}
        </div>
        <p style={{ fontSize: 10.5, color: "var(--text-disabled)" }}>
          Shapes are design-only — members never see them as fields.
        </p>
      </div>
    </div>
  );
}
