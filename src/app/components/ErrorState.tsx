import React from "react";
import { Button } from "./primitives";

/** Failure state for data loads — the counterpart to the empty states, in the
 * same visual language (centered, generous padding, quiet type). Copy stays
 * plain and non-technical; the actual error is already in the console. */
export function ErrorState({
  title,
  detail,
  onRetry,
}: {
  title: string;
  detail?: string;
  onRetry: () => void;
}) {
  return (
    <div className="text-center py-20 space-y-3 px-6">
      <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>{title}</p>
      {detail && (
        <p style={{ fontSize: "var(--type-label-size)", color: "var(--text-muted)" }}>{detail}</p>
      )}
      <Button kind="primary" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
