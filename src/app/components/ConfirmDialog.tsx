import React from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from "./ui/alert-dialog";

/** App-styled destructive confirmation on the shipped AlertDialog. Radix
 * gives us the safety defaults for free: focus lands on Cancel when the
 * dialog opens, and Escape cancels. Overlay clicks cancel via
 * onOverlayClick (AlertDialog blocks the default outside-dismiss). */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  tone = "danger",
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
  onCancel(): void;
  onConfirm(): void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <AlertDialogContent
        onOverlayClick={onCancel}
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-card)",
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle style={{ fontSize: 16, fontWeight: "var(--weight-ui)", color: "var(--text-primary)" }}>
            {title}
          </AlertDialogTitle>
          {description && (
            <AlertDialogDescription style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              {description}
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            className="sp-btn sp-btn-ghost"
            style={{ background: "transparent" }}
            onClick={onCancel}
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            className={tone === "primary" ? "sp-btn sp-btn-primary" : "sp-btn"}
            style={tone === "danger" ? { background: "var(--state-danger)", color: "#fff" } : undefined}
            onClick={onConfirm}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
