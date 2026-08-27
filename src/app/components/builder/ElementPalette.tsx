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
import type { BrandAsset } from "@/lib/types";
import {
  LOGO_PALETTE_PREFIX,
  PALETTE_ITEMS,
  PALETTE_MIME,
  TOOL_PALETTE_ID,
  type BuilderTool,
  type PaletteItem,
} from "./fieldOps";
import { SignedImg } from "../SignedImg";

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
  /** The company's uploaded logo assets — each becomes a draggable tile. */
  logos?: BrandAsset[];
  /** The canvas tool that is armed right now. The palette does not SET the
   * tool — clicking a tile still adds the element at the canvas centre, as
   * it always has — but it marks the tile the active tool will draw, so the
   * top bar and this rail never disagree about state. */
  activeTool?: BuilderTool;
}

function Tile({
  item,
  onAdd,
  armed,
}: {
  item: PaletteItem;
  onAdd(id: string): void;
  armed?: boolean;
}) {
  const Icon = ICONS[item.id] ?? Square;
  return (
    <button
      draggable
      data-armed={armed ? "true" : undefined}
      onDragStart={(e) => {
        e.dataTransfer.setData(PALETTE_MIME, item.id);
        e.dataTransfer.effectAllowed = "copy";
      }}
      onClick={() => onAdd(item.id)}
      title={
        armed
          ? `${item.label} — the active tool. Drag on the canvas to draw one, or click here to add at the center.`
          : "Drag onto the canvas, or click to add at the center"
      }
      className="sp-palette-tile flex flex-col items-center gap-1.5 py-3 px-2 transition-colors"
      style={{
        border: `1px solid ${armed ? "var(--editor-accent)" : "var(--border-strong)"}`,
        borderRadius: "var(--radius-control)",
        background: armed ? "var(--bg-hover)" : "var(--bg-surface)",
        cursor: "grab",
        fontSize: 11,
        color: armed ? "var(--text-primary)" : "var(--text-secondary)",
      }}
    >
      <Icon style={{ width: 16, height: 16 }} />
      {item.label}
    </button>
  );
}

function LogoTile({ asset, onAdd }: { asset: BrandAsset; onAdd(id: string): void }) {
  const paletteId = `${LOGO_PALETTE_PREFIX}${asset.id}`;
  const name = asset.name.replace(/\.[^.]+$/, "");
  return (
    <button
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(PALETTE_MIME, paletteId);
        e.dataTransfer.effectAllowed = "copy";
      }}
      onClick={() => onAdd(paletteId)}
      title={`${name} — drag onto the canvas, or click to add at the center`}
      className="flex flex-col items-center gap-1.5 py-2 px-2 transition-colors"
      style={{
        border: "1px solid var(--border-strong)",
        borderRadius: "var(--radius-control)",
        background: "var(--bg-surface)",
        cursor: "grab",
        fontSize: 10.5,
        color: "var(--text-secondary)",
      }}
    >
      {/* The artwork itself is the tile — a logo is recognized, not read. */}
      <span className="flex items-center justify-center w-full" style={{ height: 36 }}>
        <SignedImg
          src={asset.url}
          alt={name}
          draggable={false}
          style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
        />
      </span>
      <span className="truncate w-full text-center">{name}</span>
    </button>
  );
}

/** The Fields step's element palette: member-editable fields, decorative
 * shapes (always fixed on the graphic), then the company's logos. Drag a
 * tile onto the canvas to drop it where it lands; clicking adds at the
 * center. A dropped logo lands as a fixed image sized to its artwork and
 * always fits inside its box ("contain") — it never crops. */
export function ElementPalette({ onAdd, logos = [], activeTool = "move" }: ElementPaletteProps) {
  const fields = PALETTE_ITEMS.filter((i) => i.group === "fields");
  const shapes = PALETTE_ITEMS.filter((i) => i.group === "shapes");
  const armedId = activeTool === "move" ? null : TOOL_PALETTE_ID[activeTool];
  return (
    <div className="sp-card p-3 space-y-3">
      <div className="space-y-2">
        <h3 className="sp-eyebrow">Fields</h3>
        {/* When the builder stacks to one column (below lg), the palette spans
            the full content width — four-across keeps the tiles hand-sized. */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-2">
          {fields.map((item) => (
            <Tile key={item.id} item={item} onAdd={onAdd} armed={item.id === armedId} />
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <h3 className="sp-eyebrow">Shapes</h3>
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-3 gap-2">
          {shapes.map((item) => (
            <Tile key={item.id} item={item} onAdd={onAdd} armed={item.id === armedId} />
          ))}
        </div>
        <p style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
          Shapes are design-only — members never see them as fields.
        </p>
      </div>
      {logos.length > 0 && (
        <div className="space-y-2">
          <h3 className="sp-eyebrow">Logos</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-2">
            {logos.map((asset) => (
              <LogoTile key={asset.id} asset={asset} onAdd={onAdd} />
            ))}
          </div>
          <p style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
            Logos land fixed and always fit inside their box — no cropping.
          </p>
        </div>
      )}
    </div>
  );
}
