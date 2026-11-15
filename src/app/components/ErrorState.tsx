import React from "react";
import { Button } from "./primitives";

/** Failure state for data loads: the counterpart to the empty states, in the
 * same visual language (centered, generous padding, quiet type). Copy stays
 * plain and non-technical; the actual error is already in the console.
 *
 * It reads the Alert's Error tone (primitives/Alert.tsx): the title in
 * Label/M on feedback/error-text and the detail in Body/M on text/primary.
 * Each screen moves onto the Alert itself in its own phase. */
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
      <p className="t-label-m" style={{ color: "var(--feedback-error-text)" }}>
        {title}
      </p>
      {detail && (
        <p className="t-body-m" style={{ color: "var(--text-primary)" }}>
          {detail}
        </p>
      )}
      <Button kind="primary" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
