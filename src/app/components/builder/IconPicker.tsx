import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { elementToPath, iconTitle, searchIconNames, type LucideElement } from "@/lib/icons/lucide";

/** How many matches the grid shows at once; a search narrows the rest. */
const MAX_SHOWN = 120;
const CELL = 40;
const COLUMNS = 6;

/** The Lucide catalog loads with the first picker or glyph, so the app's
 * main bundle never carries the icon list. */
const loadCatalog = () => import("@/lib/icons/catalog");

/** One Lucide icon drawn from its own elements, loaded on first sight. */
function Glyph({ name, size = 20 }: { name: string; size?: number }) {
  const [node, setNode] = useState<readonly LucideElement[] | null>(null);
  useEffect(() => {
    let live = true;
    void loadCatalog()
      .then((c) => c.loadLucideNode(name))
      .then((n) => live && setNode(n));
    return () => {
      live = false;
    };
  }, [name]);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {node?.map((el, i) => {
        const d = elementToPath(el);
        return d ? <path key={i} d={d} /> : null;
      })}
    </svg>
  );
}

export { Glyph as IconGlyph };

interface IconPickerProps {
  anchorRef: React.RefObject<HTMLElement | null>;
  /** Which side of the anchor the popover opens on: the palette sits on the
   * left rail, the inspector on the right. */
  side: "left" | "right";
  /** The icon in use, marked in the grid. */
  selected?: string;
  onPick(name: string): void;
  onClose(): void;
}

/** Lucide's icons in a searchable grid. Picking one hands back its name;
 * the caller turns it into a vector. */
export function IconPicker({ anchorRef, side, selected, onPick, onClose }: IconPickerProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [names, setNames] = useState<readonly string[]>([]);
  useEffect(() => {
    let live = true;
    void loadCatalog().then((c) => live && setNames(c.LUCIDE_NAMES));
    return () => {
      live = false;
    };
  }, []);
  const results = useMemo(() => searchIconNames(names, query), [names, query]);
  const shown = results.slice(0, MAX_SHOWN);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (
        !surfaceRef.current?.contains(e.target as Node) &&
        !anchorRef.current?.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // The builder clears its selection on Escape too; this one is ours.
        e.stopImmediatePropagation();
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [onClose, anchorRef]);

  const rect = anchorRef.current?.getBoundingClientRect();
  const gap = 4;
  const width = CELL * COLUMNS + gap * (COLUMNS - 1) + 2 * 8 + 2;
  const maxHeight = Math.min(440, window.innerHeight - 16);
  const left = rect
    ? side === "left"
      ? Math.max(8, rect.left - width - 8)
      : Math.min(window.innerWidth - width - 8, rect.right + 8)
    : 8;
  const top = rect ? Math.min(Math.max(8, rect.top), window.innerHeight - maxHeight - 8) : 8;

  return (
    <div
      ref={surfaceRef}
      role="dialog"
      aria-label="Icon picker"
      className="fixed flex flex-col"
      style={{
        left,
        top,
        width,
        maxHeight,
        zIndex: "var(--z-popover)" as unknown as number,
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-card)",
        padding: "var(--space-2xs)",
        gap: "var(--space-2xs)",
      }}
    >
      <label className="relative flex items-center">
        <Search
          aria-hidden
          style={{
            position: "absolute",
            left: "var(--space-2xs)",
            width: 14,
            height: 14,
            color: "var(--text-muted)",
          }}
        />
        <input
          autoFocus
          className="sp-input w-full"
          style={{ paddingLeft: 28 }}
          placeholder="Search icons"
          aria-label="Search icons"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && shown[0]) onPick(shown[0]);
          }}
        />
      </label>
      {!names.length ? null : shown.length ? (
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${COLUMNS}, ${CELL}px)`,
            gap,
            overflowY: "auto",
          }}
        >
          {shown.map((name) => (
            <button
              key={name}
              type="button"
              title={iconTitle(name)}
              aria-label={iconTitle(name)}
              aria-pressed={name === selected}
              onClick={() => onPick(name)}
              className="sp-icon-cell flex items-center justify-center"
              style={{
                width: CELL,
                height: CELL,
                borderRadius: "var(--radius-menu-item)",
                color: "var(--text-primary)",
                background: name === selected ? "var(--bg-hover)" : undefined,
              }}
            >
              <Glyph name={name} />
            </button>
          ))}
        </div>
      ) : (
        <p
          style={{
            padding: "var(--space-md) 0",
            textAlign: "center",
            fontSize: 12,
            color: "var(--text-muted)",
          }}
        >
          No icons match “{query.trim()}”
        </p>
      )}
    </div>
  );
}
