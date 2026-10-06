import React, { useEffect, useState } from "react";
import { Button, Field, Input, Modal } from "../../primitives";

interface ConfirmProps {
  open: boolean;
  title: string;
  /** What the action does; a string, or a few short paragraphs. */
  body?: React.ReactNode;
  confirmLabel: string;
  /** Red, for an action Undo can't bring back (PHASE-7 §9 D5). */
  destructive?: boolean;
  /** Disables the action while it runs; it then reads "Working…". */
  busy?: boolean;
  onCancel(): void;
  onConfirm(): void;
}

/** A Settings confirmation on the Modal primitive: the question, what it
 * does, Cancel and the action. The page's buttons stay neutral as drawn;
 * the red lives here (D5). Escape and the close button cancel. */
export function ConfirmModal({
  open,
  title,
  body,
  confirmLabel,
  destructive = true,
  busy = false,
  onCancel,
  onConfirm,
}: ConfirmProps) {
  return (
    <Modal open={open} onOpenChange={(next) => !next && onCancel()} title={title}>
      {body && <ConfirmBody>{body}</ConfirmBody>}
      <div className="sp-st-confirm__actions">
        <Button kind="neutral" size="lg" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          kind={destructive ? "destructive" : "primary"}
          size="lg"
          disabled={busy}
          onClick={onConfirm}
        >
          {busy ? "Working…" : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

/** The confirmation that needs the workspace's name TYPED: the two actions
 * where a reflexive click must not be enough (revoke every public link,
 * delete the workspace). The body names the consequence; the field is the
 * brake. */
export function TypedConfirmModal({
  expected,
  ...props
}: Omit<ConfirmProps, "destructive"> & {
  /** What must be typed, verbatim: the workspace name. */
  expected: string;
}) {
  const [typed, setTyped] = useState("");
  useEffect(() => {
    if (props.open) setTyped("");
  }, [props.open]);
  const match = typed === expected;

  return (
    <Modal open={props.open} onOpenChange={(next) => !next && props.onCancel()} title={props.title}>
      {props.body && <ConfirmBody>{props.body}</ConfirmBody>}
      <Field label={`Type ${expected} to confirm`}>
        <Input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && match && !props.busy && props.onConfirm()}
          autoComplete="off"
          spellCheck={false}
        />
      </Field>
      <div className="sp-st-confirm__actions">
        <Button kind="neutral" size="lg" onClick={props.onCancel}>
          Cancel
        </Button>
        <Button
          kind="destructive"
          size="lg"
          disabled={!match || props.busy}
          onClick={props.onConfirm}
        >
          {props.busy ? "Working…" : props.confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

function ConfirmBody({ children }: { children: React.ReactNode }) {
  return typeof children === "string" ? (
    <p className="t-body-s sp-st-confirm__body">{children}</p>
  ) : (
    <div className="t-body-s sp-st-confirm__body">{children}</div>
  );
}
