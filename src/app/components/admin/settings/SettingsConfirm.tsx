import React, { useEffect, useRef, useState } from "react";
import { Button, Field, Input, Modal, ModalActions, ModalBody } from "../../primitives";

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
  /** Focus lands on Cancel when it opens, so a reflexive Enter cancels
   * (ConfirmDialog's default). */
  focusCancel?: boolean;
  /** Where focus goes when it closes, when what opened it is gone by then
   * (a row menu's item). */
  returnFocus?: React.RefObject<HTMLElement | null>;
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
  focusCancel = false,
  returnFocus,
  onCancel,
  onConfirm,
}: ConfirmProps) {
  const cancel = useRef<HTMLButtonElement>(null);
  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && onCancel()}
      title={title}
      returnFocus={returnFocus}
      onOpenAutoFocus={
        focusCancel
          ? (e) => {
              e.preventDefault();
              cancel.current?.focus();
            }
          : undefined
      }
    >
      {body && <ModalBody>{body}</ModalBody>}
      <ModalActions>
        <Button ref={cancel} kind="neutral" onClick={onCancel}>
          Cancel
        </Button>
        <Button kind={destructive ? "destructive" : "primary"} disabled={busy} onClick={onConfirm}>
          {busy ? "Working…" : confirmLabel}
        </Button>
      </ModalActions>
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
      {props.body && <ModalBody>{props.body}</ModalBody>}
      <Field label={`Type ${expected} to confirm`}>
        <Input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && match && !props.busy && props.onConfirm()}
          autoComplete="off"
          spellCheck={false}
        />
      </Field>
      <ModalActions>
        <Button kind="neutral" onClick={props.onCancel}>
          Cancel
        </Button>
        <Button kind="destructive" disabled={!match || props.busy} onClick={props.onConfirm}>
          {props.busy ? "Working…" : props.confirmLabel}
        </Button>
      </ModalActions>
    </Modal>
  );
}
