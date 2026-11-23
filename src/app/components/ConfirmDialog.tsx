import React from "react";
import { ConfirmModal } from "./admin/settings/SettingsConfirm";

/** A confirmation on the Modal primitive (new look, Phase 9): the question,
 * what it does, Cancel and the action. Focus lands on Cancel when it opens;
 * Escape, the close button and a click on the scrim cancel. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  tone = "danger",
  returnFocus,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  confirmLabel: string;
  /** danger = destructive red; primary = a consequential-but-constructive
   * confirm (e.g. applying brand changes). */
  tone?: "danger" | "primary";
  /** Where focus goes when it closes, when what opened it is gone by then
   * (a row menu's item). */
  returnFocus?: React.RefObject<HTMLElement | null>;
  onCancel(): void;
  onConfirm(): void;
}) {
  return (
    <ConfirmModal
      open={open}
      title={title}
      body={description}
      confirmLabel={confirmLabel}
      destructive={tone === "danger"}
      focusCancel
      returnFocus={returnFocus}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
