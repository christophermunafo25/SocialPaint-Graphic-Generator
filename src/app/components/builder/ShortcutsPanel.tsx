import React, { useEffect } from "react";

interface Row {
  keys: string;
  what: string;
}

interface Section {
  title: string;
  rows: Row[];
}

/** Every shortcut the canvas answers to, grouped the way an admin thinks
 * about them. This panel exists because several of the best ones — alt-click
 * to reach an element underneath, shift to lock a drag to one axis, ⌘ to
 * suppress snapping — leave no trace on screen and were otherwise
 * undiscoverable. Opened with ? and closed with Escape. */
function sections(isMac: boolean): Section[] {
  const mod = isMac ? "⌘" : "Ctrl";
  const alt = isMac ? "⌥" : "Alt";
  return [
    {
      title: "Tools",
      rows: [
        { keys: "V", what: "Move and select" },
        { keys: "T", what: "Text" },
        { keys: "R", what: "Rectangle" },
        { keys: "O", what: "Ellipse" },
        { keys: "L", what: "Line" },
        { keys: "M", what: "Image" },
        { keys: "⇧ + letter", what: "Keep the tool active for more than one draw" },
        { keys: "Esc", what: "Back to Move" },
      ],
    },
    {
      title: "View",
      rows: [
        { keys: `${mod} +`, what: "Zoom in" },
        { keys: `${mod} −`, what: "Zoom out" },
        { keys: `${mod} 0`, what: "Zoom to 100%" },
        { keys: "⇧ 1", what: "Zoom to fit" },
        { keys: "⇧ 2", what: "Zoom to selection" },
        { keys: "Space + drag", what: "Pan" },
        { keys: "Middle-drag", what: "Pan" },
        { keys: "Scroll", what: "Pan" },
        { keys: `${mod} scroll`, what: "Zoom about the pointer" },
      ],
    },
    {
      title: "Selecting",
      rows: [
        { keys: "Drag empty canvas", what: "Rubber-band select" },
        { keys: `${mod} A`, what: "Select everything" },
        { keys: "⇧ drag", what: "Add to the selection" },
        { keys: "⇧ click", what: "Add or remove one element" },
        { keys: `${alt} click`, what: "Reach the element underneath, then the one under that" },
        { keys: "Double-click", what: "Edit fixed text in place, or name a member field" },
        { keys: "Esc", what: "Deselect" },
      ],
    },
    {
      title: "Moving and resizing",
      rows: [
        { keys: "Arrows", what: "Nudge 1px" },
        { keys: "⇧ arrows", what: "Nudge 10px" },
        { keys: "⇧ drag", what: "Lock the move to one axis" },
        { keys: "⇧ resize", what: "Keep the proportions" },
        { keys: `${alt} resize`, what: "Resize from the centre" },
        { keys: `${mod} drag`, what: "Suppress snapping" },
        { keys: "Corner zones", what: "Rotate; ⇧ snaps to 15°" },
      ],
    },
    {
      title: "Editing",
      rows: [
        { keys: `${mod} Z`, what: "Undo" },
        { keys: isMac ? "⇧⌘ Z" : "Ctrl Y", what: "Redo" },
        { keys: `${mod} C / X / V`, what: "Copy, cut, paste" },
        { keys: `${alt}${mod} C / V`, what: "Copy and paste the style only" },
        { keys: `${mod} D`, what: "Duplicate" },
        { keys: `${mod} G`, what: "Group" },
        { keys: isMac ? "⇧⌘ G" : "Ctrl Shift G", what: "Ungroup" },
        { keys: "Delete", what: "Delete the selection" },
        { keys: "?", what: "Open and close this list" },
      ],
    },
  ];
}

export function ShortcutsPanel({ isMac, onClose }: { isMac: boolean; onClose(): void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "color-mix(in srgb, var(--text-on-accent) 45%, transparent)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full overflow-y-auto"
        style={{
          maxWidth: 860,
          maxHeight: "80dvh",
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-card)",
          padding: "var(--space-md)",
        }}
      >
        <header className="flex items-center justify-between gap-4 mb-4">
          <h2
            style={{
              fontFamily: "var(--font-head)",
              fontWeight: "var(--weight-head)",
              fontSize: 21,
              letterSpacing: "var(--track-head)",
              color: "var(--text-primary)",
            }}
          >
            Keyboard shortcuts
          </h2>
          <button onClick={onClose} className="sp-btn sp-btn-ghost" style={{ minHeight: 32 }}>
            Close
          </button>
        </header>
        <div
          className="grid gap-x-8 gap-y-5"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}
        >
          {sections(isMac).map((section) => (
            <section key={section.title}>
              <h3 className="sp-eyebrow" style={{ marginBottom: "var(--space-2xs)" }}>
                {section.title}
              </h3>
              <dl className="space-y-1">
                {section.rows.map((row) => (
                  <div key={row.keys + row.what} className="flex items-baseline gap-3">
                    <dt
                      className="flex-shrink-0 text-right"
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                        color: "var(--text-primary)",
                        minWidth: 96,
                      }}
                    >
                      {row.keys}
                    </dt>
                    <dd
                      style={{
                        fontSize: "var(--type-caption-size)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {row.what}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
