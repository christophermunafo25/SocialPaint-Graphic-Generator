import React from "react";
import { Check } from "lucide-react";

export type WizardStep = "name" | "fields" | "caption" | "details";

export interface StepDef {
  key: WizardStep;
  title: string;
  optional?: boolean;
}

/** Fields first: the design is what the admin came to build, and the name
 *  reads better once there's something to name. Publish still demands a real
 *  name, so it stays a required step — just the last one. */
export const WIZARD_STEPS: StepDef[] = [
  { key: "fields", title: "Fields" },
  { key: "caption", title: "Caption", optional: true },
  { key: "details", title: "Tags & details", optional: true },
  { key: "name", title: "Name" },
];

interface WizardStepBarProps {
  current: WizardStep;
  /** Steps whose requirements are met (jumpable at any time). */
  complete: Set<WizardStep>;
  /** Whether each step may be jumped to right now. */
  canGo(step: WizardStep): boolean;
  onGo(step: WizardStep): void;
}

/** The wizard, compacted into the editor's top bar. Fields is no longer a
 * page — it IS the editor — so this reads as a segmented control over the
 * three panels that sit beside it, with the same check marks and the same
 * reachability rules the stepper had. */
export function WizardStepBar({ current, complete, canGo, onGo }: WizardStepBarProps) {
  return (
    <nav
      aria-label="Template creation steps"
      className="flex items-center flex-shrink-0 overflow-hidden"
      data-radius-control
      style={{ border: "1px solid var(--border-strong)", borderRadius: "var(--radius-control)" }}
    >
      {WIZARD_STEPS.map((s, i) => {
        const isCurrent = s.key === current;
        const isComplete = complete.has(s.key) && !isCurrent;
        const reachable = canGo(s.key);
        return (
          <button
            key={s.key}
            onClick={() => reachable && onGo(s.key)}
            disabled={!reachable}
            aria-current={isCurrent ? "step" : undefined}
            title={s.optional ? `${s.title} — optional` : s.title}
            className="flex items-center gap-1.5 px-2.5 py-1.5 whitespace-nowrap"
            style={{
              fontSize: "var(--type-caption-size)",
              fontWeight: isCurrent ? 500 : 400,
              borderLeft: i > 0 ? "1px solid var(--border)" : undefined,
              background: isCurrent ? "var(--fill-action)" : "var(--bg-surface)",
              color: isCurrent ? "var(--text-on-action)" : "var(--text-secondary)",
              cursor: reachable ? "pointer" : "default",
              opacity: reachable || isCurrent ? 1 : 0.45,
            }}
          >
            {isComplete ? (
              <Check aria-hidden style={{ width: 11, height: 11, color: "var(--state-primary)" }} />
            ) : (
              <span
                aria-hidden
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  color: isCurrent ? "var(--text-on-action)" : "var(--text-muted)",
                }}
              >
                {i + 1}
              </span>
            )}
            {s.title}
          </button>
        );
      })}
    </nav>
  );
}
