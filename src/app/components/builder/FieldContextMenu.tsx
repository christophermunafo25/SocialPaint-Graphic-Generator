import React, { useEffect, useRef } from "react";

export interface MenuAction {
  label: string;
  shortcut?: string;
  disabled?: boolean;
  destructive?: boolean;
  /** Hairline above this item. The menus now carry align and distribute as
   * well as the clipboard, and an undivided list of fifteen reads as one
   * undifferentiated wall. */
  separated?: boolean;
  onSelect(): void;
}

interface FieldContextMenuProps {
  x: number;
  y: number;
  actions: MenuAction[];
  onClose(): void;
}

/** Lightweight right-click menu for canvas boxes and field-list rows. Closes
 * on outside click, Escape, or after any action. */
export function FieldContextMenu({ x, y, actions, onClose }: FieldContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown, true);
    };
  }, [onClose]);

  // Keep the menu on-screen near the pointer. A long menu scrolls rather
  // than running off the bottom, so the estimate is capped at what the
  // panel will actually be allowed to grow to.
  const maxHeight = Math.round(window.innerHeight * 0.7);
  const estimated = Math.min(actions.length * 30 + 12, maxHeight);
  const left = Math.min(x, window.innerWidth - 200);
  const top = Math.max(8, Math.min(y, window.innerHeight - estimated - 8));

  return (
    <div
      ref={ref}
      className="fixed z-50 py-1.5 overflow-y-auto"
      style={{
        left,
        top,
        minWidth: 180,
        maxHeight,
        background: "var(--bg-surface)",
        border: "1px solid var(--border-strong)",
        borderRadius: "var(--radius-card)",
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {actions.map((a) => (
        <button
          key={a.label}
          disabled={a.disabled}
          onClick={() => {
            onClose();
            a.onSelect();
          }}
          className="w-full flex items-center justify-between gap-6 px-3 py-1.5 text-left"
          style={{
            fontSize: 12.5,
            color: a.destructive ? "var(--destructive)" : "var(--text-primary)",
            opacity: a.disabled ? 0.4 : 1,
            cursor: a.disabled ? "default" : "pointer",
            borderTop: a.separated ? "1px solid var(--border)" : undefined,
            marginTop: a.separated ? 4 : undefined,
            paddingTop: a.separated ? 6 : undefined,
          }}
          onMouseEnter={(e) => {
            if (!a.disabled) (e.currentTarget as HTMLElement).style.background = "var(--bg-raised)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
          }}
        >
          {a.label}
          {a.shortcut && (
            <span
              style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)" }}
            >
              {a.shortcut}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
