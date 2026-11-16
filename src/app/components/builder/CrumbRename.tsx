import React, { useEffect, useRef, useState } from "react";
import { Input } from "../primitives";

/** The editor's last crumb (322:157): the template's name, and the way to
 * rename it. A click turns it into a Small input; Enter or a click away
 * keeps the new name, Escape keeps the old one. An empty name is no change.
 * It is the page's heading. */
export function CrumbRename({
  value,
  placeholder,
  onSave,
}: {
  value: string;
  placeholder: string;
  onSave(next: string): void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);
  const button = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const shown = value.trim() || placeholder;

  useEffect(() => {
    if (!editing) return;
    input.current?.focus();
    input.current?.select();
  }, [editing]);

  const finish = (save: boolean) => {
    if (!editing) return;
    setEditing(false);
    const next = text.trim();
    if (save && next && next !== value.trim()) onSave(next);
    requestAnimationFrame(() => button.current?.focus());
  };

  return (
    <h1 className="sp-crumb-rename" aria-current="page">
      {editing ? (
        <Input
          ref={input}
          size="sm"
          aria-label="Template name"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => finish(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              finish(true);
            } else if (e.key === "Escape") {
              e.preventDefault();
              finish(false);
            }
          }}
          className="sp-crumb-rename__input"
        />
      ) : (
        <button
          ref={button}
          type="button"
          className="ui-reset ui-ring t-label-m ui-breadcrumb__current sp-crumb-rename__name"
          aria-label={`${shown}, rename`}
          onClick={() => {
            setText(value.trim() ? value : "");
            setEditing(true);
          }}
        >
          {shown}
        </button>
      )}
    </h1>
  );
}
