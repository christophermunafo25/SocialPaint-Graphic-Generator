import React, { useId, useRef } from "react";
import type { FieldValues, TemplateSchema } from "@/lib/types";
import { defaultVariant } from "@/lib/templates/variants";
import { TemplateThumbnail } from "../TemplateThumbnail";

/** The width of one look option (Figma sp-look-option in 381:235). */
const OPTION_WIDTH = 140;

/** The Looks card beside a template chat's result (Figma "Looks" card in
 * 381:235, sp-look-option; template-chat PROMPT §11.10): "Look" over one
 * option per look, 24 apart, each the draft rendered in that look, its name
 * below, and "SELECTED" beside the chosen one's name. The chosen option
 * carries the draft cards' selected outline. Looks come in the template's
 * own order, the fill page's "Choose a look" order.
 *
 * A radio group: arrows move the choice, as the fill page's picker does.
 * Switching is instant and never calls the model (§9.5). Rendered only for
 * a template with more than one look. */
export function LookPicker({
  schema,
  values,
  variantId,
  onPick,
}: {
  schema: TemplateSchema;
  /** The draft's painted values (the turn's photo in its slot). */
  values: FieldValues;
  variantId: string | undefined;
  onPick(variantId: string): void;
}) {
  const titleId = useId();
  const looks = schema.variants ?? [];
  const selected = variantId ?? defaultVariant(schema)?.id;
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const aspect = `${schema.canvasWidth} / ${schema.canvasHeight}`;

  const onKeyDown = (e: React.KeyboardEvent) => {
    const i = looks.findIndex((v) => v.id === selected);
    const step =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? 1
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? -1
          : 0;
    if (!step || i < 0) return;
    e.preventDefault();
    const next = looks[(i + step + looks.length) % looks.length];
    onPick(next.id);
    refs.current.get(next.id)?.focus();
  };

  return (
    <div className="sp-card sp-chat-looks">
      <p id={titleId} className="sp-chat-looks__title">
        Look
      </p>
      <div
        className="sp-chat-looks__options"
        role="radiogroup"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
      >
        {looks.map((v) => {
          const on = v.id === selected;
          return (
            <div key={v.id} className="sp-chat-looks__option" style={{ width: OPTION_WIDTH }}>
              <button
                ref={(el) => {
                  if (el) refs.current.set(v.id, el);
                  else refs.current.delete(v.id);
                }}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={v.name}
                tabIndex={on ? 0 : -1}
                className="sp-chat-looks__thumb"
                data-selected={on || undefined}
                style={{ aspectRatio: aspect }}
                onClick={() => onPick(v.id)}
              >
                <TemplateThumbnail
                  template={schema}
                  values={values}
                  variantId={v.id}
                  emptyFields="chat"
                />
              </button>
              <p className="sp-chat-looks__name" aria-hidden>
                <span>{v.name}</span>
                {on && <span className="sp-chat-looks__selected">Selected</span>}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** The Looks card while the draft is still being built: the title bar and
 * one well per look, in the draft card skeletons' fill. */
export function LookPickerSkeleton({ count, aspect }: { count: number; aspect: number }) {
  return (
    <div className="sp-card sp-chat-looks" data-skeleton aria-hidden>
      <span className="sp-chat-looks__bar" />
      <div className="sp-chat-looks__options">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="sp-chat-looks__option" style={{ width: OPTION_WIDTH }}>
            <span className="sp-chat-looks__thumb" style={{ aspectRatio: String(aspect) }} />
            <span className="sp-chat-looks__bar" data-short />
          </div>
        ))}
      </div>
    </div>
  );
}
