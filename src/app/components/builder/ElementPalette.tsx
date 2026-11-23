import React, { useMemo, useRef, useState } from "react";
import {
  Badge as BadgeGlyph,
  Circle,
  Figma,
  Image as ImageGlyph,
  List,
  Minus,
  PencilRuler,
  RectangleHorizontal,
  Smile,
  Square,
  Star,
  Text as TextGlyph,
  Triangle,
  Type as TypeGlyph,
  type LucideIcon,
} from "lucide-react";
import type { BrandAsset } from "@/lib/types";
import { LOGO_PALETTE_PREFIX, PALETTE_MIME } from "./fieldOps";
import { SignedImg } from "../SignedImg";
import { IconPicker } from "./IconPicker";
import { Menu, MenuItem } from "../primitives";
import type { IconComponent } from "../primitives/cx";

interface TileSpec {
  /** The PALETTE_ITEMS id the tile adds. */
  id: string;
  label: string;
  icon: LucideIcon;
}

/** The grid as drawn (322:196), three across. The Logo tile sits between
 * Image and Pill; Triangle, Star and Icon follow the frame's nine, so every
 * element the builder draws stays a tile. */
const BEFORE_LOGO: TileSpec[] = [
  { id: "text", label: "Text", icon: TypeGlyph },
  { id: "multiline", label: "Paragraph", icon: TextGlyph },
  { id: "select", label: "Dropdown", icon: List },
  { id: "image", label: "Image", icon: ImageGlyph },
];
const AFTER_LOGO: TileSpec[] = [
  { id: "pill", label: "Pill", icon: RectangleHorizontal },
  { id: "rect", label: "Rectangle", icon: Square },
  { id: "ellipse", label: "Ellipse", icon: Circle },
  { id: "line", label: "Line", icon: Minus },
  { id: "triangle", label: "Triangle", icon: Triangle },
  { id: "star", label: "Star", icon: Star },
];

interface ElementTileProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  label: string;
  /** Set when the tile can be dragged onto the canvas. */
  paletteId?: string;
}

/** Element Tile (321:77): 70 by 60 on surface/sunken, an 18 icon over its
 * Caption/M name. Forwards its ref and props so a Menu can open from it. */
const ElementTile = React.forwardRef<HTMLButtonElement, ElementTileProps>(function ElementTile(
  { icon: Icon, label, paletteId, className, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className={["ui-reset ui-ring sp-element-tile", className].filter(Boolean).join(" ")}
      draggable={paletteId ? true : undefined}
      onDragStart={
        paletteId
          ? (e) => {
              e.dataTransfer.setData(PALETTE_MIME, paletteId);
              e.dataTransfer.effectAllowed = "copy";
            }
          : undefined
      }
      {...rest}
    >
      <Icon size={18} strokeWidth={1.5} className="ui-icon" aria-hidden />
      <span className="t-caption-m sp-element-tile__label">{label}</span>
    </button>
  );
});

/** A logo's artwork at the size of a menu icon: a logo is recognised, not
 * read. */
function logoThumb(asset: BrandAsset): IconComponent {
  return function LogoThumb({ size = 16, className }) {
    return (
      <SignedImg
        src={asset.url}
        alt=""
        draggable={false}
        className={className}
        style={{ width: size, height: size, objectFit: "contain" }}
      />
    );
  };
}

const logoName = (asset: BrandAsset) => asset.name.replace(/\.[^.]+$/, "");

/** The Logo tile. One logo adds on a click and drags like any tile; with
 * several it opens a menu of their artwork; with none, the menu offers
 * Brand Studio, where logos are added. */
function LogoTile({
  logos,
  onAdd,
  onOpenLogos,
}: {
  logos: BrandAsset[];
  onAdd(paletteId: string): void;
  onOpenLogos(): void;
}) {
  const thumbs = useMemo(() => new Map(logos.map((a) => [a.id, logoThumb(a)])), [logos]);
  if (logos.length === 1) {
    const paletteId = `${LOGO_PALETTE_PREFIX}${logos[0].id}`;
    return (
      <ElementTile
        icon={BadgeGlyph}
        label="Logo"
        paletteId={paletteId}
        onClick={() => onAdd(paletteId)}
      />
    );
  }
  return (
    <Menu trigger={<ElementTile icon={BadgeGlyph} label="Logo" />} aria-label="Logos">
      {logos.length === 0 ? (
        <MenuItem icon={BadgeGlyph} onSelect={onOpenLogos}>
          Add a logo in Brand Studio
        </MenuItem>
      ) : (
        logos.map((asset) => (
          <MenuItem
            key={asset.id}
            icon={thumbs.get(asset.id)}
            onSelect={() => onAdd(`${LOGO_PALETTE_PREFIX}${asset.id}`)}
          >
            {logoName(asset)}
          </MenuItem>
        ))
      )}
    </Menu>
  );
}

/** The Icon tile opens the icon picker; picking one adds it. */
function IconTile({ onAddIcon }: { onAddIcon(name: string): void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <ElementTile
        ref={ref}
        icon={Smile}
        label="Icon"
        aria-haspopup="dialog"
        aria-expanded={open}
        data-open={open || undefined}
        onClick={() => setOpen((o) => !o)}
      />
      {open && (
        <IconPicker
          anchorRef={ref}
          side="right"
          onPick={(name) => {
            setOpen(false);
            onAddIcon(name);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

interface ElementPaletteProps {
  /** Adds the element at the canvas centre. A tile dragged onto the canvas
   * lands where it is dropped instead. */
  onAdd(paletteId: string): void;
  /** Adds the picked Lucide icon at the canvas centre. */
  onAddIcon(name: string): void;
  /** The brand's logos. */
  logos?: BrandAsset[];
  /** Opens Brand Studio's logos, for a brand with none. */
  onOpenLogos(): void;
  /** Present when the workspace can import a design. */
  onImportFigma?(): void;
  onAutoBuild?(): void;
}

/** The rail's Add section (322:194): Mono/Eyebrow over the tiles, 10
 * apart, then Import when the workspace can import. */
export function ElementPalette({
  onAdd,
  onAddIcon,
  logos = [],
  onOpenLogos,
  onImportFigma,
  onAutoBuild,
}: ElementPaletteProps) {
  const tile = (t: TileSpec) => (
    <ElementTile
      key={t.id}
      icon={t.icon}
      label={t.label}
      paletteId={t.id}
      onClick={() => onAdd(t.id)}
    />
  );
  return (
    <>
      <section className="sp-palette" aria-labelledby="sp-palette-add">
        <h3 id="sp-palette-add" className="t-mono-eyebrow sp-palette__title">
          Add
        </h3>
        <div className="sp-palette__grid">
          {BEFORE_LOGO.map(tile)}
          <LogoTile logos={logos} onAdd={onAdd} onOpenLogos={onOpenLogos} />
          {AFTER_LOGO.map(tile)}
          <IconTile onAddIcon={onAddIcon} />
        </div>
      </section>
      {onImportFigma && onAutoBuild && (
        <section className="sp-palette" aria-labelledby="sp-palette-import">
          <h3 id="sp-palette-import" className="t-mono-eyebrow sp-palette__title">
            Import
          </h3>
          <div className="sp-palette__grid">
            <ElementTile
              icon={Figma}
              label="Figma"
              aria-label="Import from Figma"
              onClick={onImportFigma}
            />
            <ElementTile icon={PencilRuler} label="Auto build" onClick={onAutoBuild} />
          </div>
        </section>
      )}
    </>
  );
}
