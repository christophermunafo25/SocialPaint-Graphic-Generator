import React, { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Input, RowMenu, type RowMenuGroup } from "../primitives";

/** The inspector's header (322:381): what is selected, as its 18 glyph and
 * its name in Title/Card, then its more menu. A name that can change
 * renames in place, as the trail's last crumb does: a click turns it into a
 * Small input, Enter or a click away keeps the new name, and Escape keeps
 * the old one. Enter and Escape hand focus back to the name.
 *
 * Give it a `key` for what it names. A rename still open when the selection
 * moves (the canvas selects on pointerdown, before the input loses focus)
 * is kept for the element it began on, never the one selected next. */
export function InspectorHeader({
  icon: Icon,
  name,
  onRename,
  renameRequest,
  actions,
}: {
  icon: LucideIcon;
  name: string;
  /** Present when the name can change. */
  onRename?(next: string): void;
  /** Changes when the builder opens the rename itself (a just-added
   * element). Any new value opens it once. */
  renameRequest?: string | null;
  /** The more menu's groups. */
  actions?: RowMenuGroup[];
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(name);
  const button = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);

  // What an unmount needs to keep an open rename: the text as typed, the
  // name it started from and the callback for the element it names.
  const pending = useRef<{ text: string; name: string; onRename?(next: string): void } | null>(
    null,
  );
  useEffect(() => {
    pending.current = editing ? { text, name, onRename } : null;
  });
  useEffect(
    () => () => {
      const open = pending.current;
      if (!open) return;
      const next = open.text.trim();
      if (next && next !== open.name) open.onRename?.(next);
    },
    [],
  );

  useEffect(() => {
    if (!renameRequest || !onRename) return;
    setText(name);
    setEditing(true);
    // Opens on the request alone; the name is read as it stands then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renameRequest]);

  useEffect(() => {
    if (!editing) return;
    input.current?.focus();
    input.current?.select();
  }, [editing]);

  const finish = (save: boolean, refocus: boolean) => {
    if (!editing) return;
    setEditing(false);
    const next = text.trim();
    if (save && next && next !== name) onRename?.(next);
    if (refocus) requestAnimationFrame(() => button.current?.focus());
  };

  return (
    <header className="sp-insp-head">
      <Icon size={18} strokeWidth={1.5} className="ui-icon sp-insp-head__icon" aria-hidden />
      {editing ? (
        <Input
          ref={input}
          size="sm"
          aria-label="Name"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => finish(true, false)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") {
              e.preventDefault();
              finish(true, true);
            } else if (e.key === "Escape") {
              e.preventDefault();
              finish(false, true);
            }
          }}
          className="sp-insp-head__input"
        />
      ) : (
        <h2 className="t-title-card sp-insp-head__title">
          {onRename ? (
            <button
              ref={button}
              type="button"
              className="ui-reset ui-ring sp-insp-head__rename"
              aria-label={`${name}, rename`}
              onClick={() => {
                setText(name);
                setEditing(true);
              }}
            >
              {name}
            </button>
          ) : (
            name
          )}
        </h2>
      )}
      {actions && actions.length > 0 && (
        <RowMenu label={`More actions for ${name}`} groups={actions} />
      )}
    </header>
  );
}
