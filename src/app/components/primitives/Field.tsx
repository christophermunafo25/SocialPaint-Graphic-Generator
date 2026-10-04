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

export interface FieldProps {
  /** The visible label, tied to the control with htmlFor. */
  label: React.ReactNode;
  /** The message under the control while the value is invalid or a required
   * value is missing. Fields have no hint or helper text (RULES §9). */
  error?: string | null;
  /** One control: an Input, TextArea or Select. */
  children: React.ReactElement<ControlProps>;
  className?: string;
}

/** Field (Figma 48:38): a label over one control, and the error 6 under it
 * when there is one (182:1965). The control keeps its look; it gets
 * aria-invalid, and its aria-describedby points at the message. */
export function Field({ label, error, children, className }: FieldProps) {
  const fallbackId = useId();
  const errorId = useId();
  const controlId = children.props.id ?? fallbackId;
  const describedBy =
    [children.props["aria-describedby"], error ? errorId : null].filter(Boolean).join(" ") ||
    undefined;
  return (
    <div className={cx("ui-field", className)}>
      <label htmlFor={controlId} className="t-label-xs ui-field__label">
        {label}
      </label>
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
