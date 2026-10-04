import React, { useId } from "react";
import { cx, type DemoStateAttr } from "./cx";

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  /** Default 40, Small 32. */
  size?: "default" | "sm";
  "data-demo-state"?: DemoStateAttr;
}

/** Input (Figma 48:37). No border; hover tints the fill; focus shows the
 * caret and nothing else. */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { size = "default", className, type = "text", ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      className={cx(
        "ui-reset ui-tint ui-ring-none ui-input",
        size === "sm" ? "t-body-xs" : "t-body-s",
        className,
      )}
      data-size={size}
      {...rest}
    />
  );
});

export interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  "data-demo-state"?: DemoStateAttr;
}

/** Input, Size=Multiline (Figma 48:30): 100 tall, top-aligned text. */
export const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { className, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={cx("ui-reset ui-tint ui-ring-none ui-input t-body-s", className)}
      data-size="multiline"
      {...rest}
    />
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
   * (RULES §9). */
  error?: string | null;
  /** Edited: the value differs from when the panel opened (a state/selection
   * dot and the word, after the label). */
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

/** Field (Figma 48:38): a label row over one control, and the error 6 under
 * it when there is one (182:1965). The label row carries markers, never
 * hint text (217:2271): Edited after the label, Optional and an Action at
 * the right. The control keeps its look; it gets aria-invalid, and its
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
            <span className="t-caption-s ui-field__marker ui-field__edited">
              <span className="ui-field__dot" aria-hidden />
              Edited
            </span>
          )}
        </span>
        {(optional || action) && (
          <span className="ui-field__end">
            {optional && <span className="t-caption-s ui-field__marker">Optional</span>}
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
        <p id={errorId} className="t-caption-s ui-field__error">
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
