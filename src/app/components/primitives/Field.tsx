import React, { useId } from "react";
import { Check, Copy } from "lucide-react";
import { cx, type DemoStateAttr, type IconComponent } from "./cx";
import { IconButton } from "./IconButton";

export type FieldSize = "sm" | "md" | "lg";

/** Body/S at Small, Body/M at Medium and Large, for a field's text outside
 * an input (a select's value). */
export const fieldTextClass = (size: FieldSize): string =>
  size === "sm" ? "t-body-s" : "t-body-m";

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  /** Small 28, Medium 36, Large 44. */
  size?: FieldSize;
  /** A leading icon, drawn at 16 on text/secondary. */
  icon?: IconComponent;
  "data-demo-state"?: DemoStateAttr;
}

/** Input (Figma 2207:263) on surface/field. Hover adds a hairline edge,
 * focus is the 2 px ring, an invalid value takes the error edge, and
 * disabled is action/disabled under text/disabled. With an icon the input
 * sits in a box that carries those states; `className` and the demo state
 * go to the box, and everything else to the input.
 *
 * The input takes no text style class. The classes trim to cap height, and
 * Chromium applies the trim to an input's inner box and clips accents and
 * descenders. primitives.css sets Body/S or Body/M from the style's
 * variables instead. */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { size = "md", icon: Icon, className, type = "text", "data-demo-state": demoState, ...rest },
  ref,
) {
  if (!Icon) {
    return (
      <input
        ref={ref}
        type={type}
        className={cx("ui-reset ui-fill ui-ring ui-input", className)}
        data-size={size}
        data-demo-state={demoState}
        {...rest}
      />
    );
  }
  // The box is a label, so a click on the icon or the padding lands in the
  // input. It holds no text, so it adds nothing to the input's name.
  return (
    <label
      className={cx("ui-fill ui-ring ui-input ui-input--box", className)}
      data-size={size}
      data-demo-state={demoState}
    >
      <Icon size={16} className="ui-icon ui-input__icon" aria-hidden />
      <input ref={ref} type={type} className="ui-reset ui-input__control" {...rest} />
    </label>
  );
});

export interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  "data-demo-state"?: DemoStateAttr;
  /** A generated caption's copy button (judgement call 10): a Small Ghost
   * Icon Button 6 in from the box's bottom right, its glyph swapping to the
   * drawn check while `copied`. */
  copy?: { label: string; onCopy(): void; copied?: boolean };
}

/** Text area (Figma 2207:298): 96 tall with 12 around the text, growing
 * with what is typed, and the Input's states. Like the Input it takes no
 * text style class: a trim would move the value and leave the placeholder
 * where it was. primitives.css sets Body/M. */
export const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { className, copy, ...rest },
  ref,
) {
  const area = (
    <textarea
      ref={ref}
      className={cx("ui-reset ui-fill ui-ring ui-input", className)}
      data-size="multiline"
      data-copy={copy ? "" : undefined}
      {...rest}
    />
  );
  if (!copy) return area;
  return (
    <span className="ui-textarea-copy">
      {area}
      <IconButton
        variant="ghost"
        size="sm"
        icon={copy.copied ? Check : Copy}
        label={copy.label}
        className="ui-textarea-copy__button"
        onClick={copy.onCopy}
      />
    </span>
  );
});

type ControlProps = {
  id?: string;
  "aria-invalid"?: React.AriaAttributes["aria-invalid"];
  "aria-describedby"?: string;
};

export interface FieldAction {
  /** The action's text ("Copy", then "Copied" for a moment). */
  label: string;
  onClick(): void;
}

export interface FieldProps {
  /** The visible label, tied to the control with htmlFor. */
  label: React.ReactNode;
  /** The message under the control while the value is invalid, too long or
   * a required value is missing. Fields have no hint or helper text
   * (RULES section 9): the component's help text property stays off. */
  error?: string | null;
  /** Edited: the value differs from when the panel opened (a dot on
   * editor/selection and the word, after the label). */
  edited?: boolean;
  /** Optional: right-aligned on the label row, on a field that can stay
   * empty. */
  optional?: boolean;
  /** A text action at the far right of the label row (Copy on a caption). */
  action?: FieldAction;
  /** One control: an Input, TextArea, Select or Upload. */
  children: React.ReactElement<ControlProps>;
  className?: string;
}

/** Field (Figma 4015:628): a label row in Label/XS, 6 over one control, and
 * the error 6 under it when there is one. The label row carries markers,
 * never hint text: Edited after the label, Optional and an action at the
 * right. The control gets aria-invalid, which draws its error edge, and its
 * aria-describedby points at the message. */
export function Field({
  label,
  error,
  edited = false,
  optional = false,
  action,
  children,
  className,
}: FieldProps) {
  const fallbackId = useId();
  const errorId = useId();
  const controlId = children.props.id ?? fallbackId;
  const describedBy =
    [children.props["aria-describedby"], error ? errorId : null].filter(Boolean).join(" ") ||
    undefined;
  return (
    <div className={cx("ui-field", className)}>
      <div className="ui-field__row">
        <span className="ui-field__lead">
          <label htmlFor={controlId} className="t-label-xs ui-field__label">
            {label}
          </label>
          {edited && (
            <span className="t-caption-m ui-field__marker ui-field__edited">
              <span className="ui-field__dot" aria-hidden />
              Edited
            </span>
          )}
        </span>
        {(optional || action) && (
          <span className="ui-field__end">
            {optional && <span className="t-caption-m ui-field__marker">Optional</span>}
            {action && (
              <button
                type="button"
                onClick={action.onClick}
                className="ui-reset ui-ring t-label-xs ui-field__action"
              >
                {action.label}
              </button>
            )}
          </span>
        )}
      </div>
      {React.cloneElement(children, {
        id: controlId,
        "aria-invalid": error ? true : children.props["aria-invalid"],
        "aria-describedby": describedBy,
      })}
      {error && (
        <p id={errorId} className="t-caption-m ui-field__error">
          {error}
        </p>
      )}
    </div>
  );
}

/** On a submit that failed validation: moves focus to the first control in
 * the form marked aria-invalid, in document order. Returns whether there
 * was one. */
export function focusFirstInvalid(form: HTMLFormElement): boolean {
  const first = form.querySelector<HTMLElement>('[aria-invalid="true"]');
  first?.focus();
  return first !== null;
}
