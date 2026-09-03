import React, { useEffect, useState } from "react";
import { X } from "lucide-react";

/** The PeopleAdmin-style dev-backend notice: a section that depends on the
 * Supabase backend says so instead of rendering a button that fails. */
export function DevBackendNotice({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="px-4 py-3"
      data-radius-control
      style={{
        fontSize: "var(--type-caption-size)",
        background: "var(--bg-hover)",
        color: "var(--text-secondary)",
      }}
    >
      {children}
    </p>
  );
}

/** One titled card in a settings section. */
export function SettingsCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="sp-card sp-card--content space-y-3">
      <div>
        <h2 className="sp-panel-title">{title}</h2>
        {description && (
          <p
            style={{
              fontSize: "var(--type-caption-size)",
              color: "var(--text-muted)",
              marginTop: 2,
            }}
          >
            {description}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}

/** A label + description column beside a control — the switch-row layout
 * TemplateLinksDialog already uses, extracted so every settings row reads
 * the same. */
export function ControlRow({
  title,
  description,
  control,
}: {
  title: string;
  description?: React.ReactNode;
  control: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between" style={{ gap: "var(--space-sm)" }}>
      <div className="min-w-0">
        <p style={{ fontSize: 14, color: "var(--text-primary)" }}>{title}</p>
        {description && (
          <p style={{ fontSize: "var(--type-caption-size)", color: "var(--text-muted)" }}>
            {description}
          </p>
        )}
      </div>
      <div className="flex-shrink-0">{control}</div>
    </div>
  );
}

/** Destructive confirmation that requires TYPING the workspace name — for
 * the two actions where a reflexive click must not be enough: revoke every
 * public link, and delete the workspace. The description names the
 * consequence; the input is the brake. */
export function TypedConfirmDialog({
  open,
  title,
  description,
  expected,
  confirmLabel,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: React.ReactNode;
  /** What must be typed, verbatim — the workspace name. */
  expected: string;
  confirmLabel: string;
  busy?: boolean;
  onCancel(): void;
  onConfirm(): void;
}) {
  const [typed, setTyped] = useState("");
  useEffect(() => {
    if (open) setTyped("");
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;
  const match = typed === expected;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="w-full max-w-md p-6 space-y-4"
        style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-card)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between" style={{ gap: "var(--space-sm)" }}>
          <h2
            style={{
              fontSize: "var(--type-cardtitle-size)",
              fontWeight: "var(--weight-ui)",
              color: "var(--text-primary)",
            }}
          >
            {title}
          </h2>
          <button onClick={onCancel} aria-label="Cancel" style={{ flexShrink: 0 }}>
            <X style={{ width: 18, height: 18, color: "var(--text-muted)" }} />
          </button>
        </div>
        <div style={{ fontSize: "var(--type-label-size)", color: "var(--text-secondary)" }}>
          {description}
        </div>
        <div>
          <label
            htmlFor="typed-confirm"
            className="sp-eyebrow block"
            style={{ marginBottom: "var(--space-3xs)" }}
          >
            Type {expected} to confirm
          </label>
          <input
            id="typed-confirm"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            className="sp-input"
          />
        </div>
        <div className="flex justify-end" style={{ gap: "var(--space-2xs)" }}>
          <button onClick={onCancel} className="sp-btn sp-btn-ghost">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!match || busy}
            className="sp-btn"
            style={{
              background: "var(--state-danger)",
              color: "var(--bg-surface)",
              opacity: !match || busy ? 0.5 : 1,
            }}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
