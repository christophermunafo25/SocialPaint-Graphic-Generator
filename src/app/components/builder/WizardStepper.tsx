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

interface WizardStepperProps {
  current: WizardStep;
  /** Steps whose requirements are met (jumpable at any time). */
  complete: Set<WizardStep>;
  /** Whether each step may be jumped to right now. */
  canGo(step: WizardStep): boolean;
  onGo(step: WizardStep): void;
}

/** Persistent progress indicator: numbered steps, check marks on completed
 * ones, click any reachable step to jump. */
export function WizardStepper({ current, complete, canGo, onGo }: WizardStepperProps) {
  return (
    <nav aria-label="Template creation steps" className="flex items-center gap-1 flex-wrap mb-6">
      {WIZARD_STEPS.map((s, i) => {
        const isCurrent = s.key === current;
        const isComplete = complete.has(s.key) && !isCurrent;
        const reachable = canGo(s.key);
        return (
          <React.Fragment key={s.key}>
            {i > 0 && (
              <span
                aria-hidden
                style={{
                  width: 20,
                  height: 1,
                  background: "var(--border-strong)",
                  margin: "0 2px",
                }}
              />
            )}
            <button
              onClick={() => reachable && onGo(s.key)}
              disabled={!reachable}
              aria-current={isCurrent ? "step" : undefined}
              className="flex items-center gap-2 px-2.5 py-1.5"
              style={{
                borderRadius: "var(--radius-pill)",
                background: isCurrent ? "var(--fill-action)" : "transparent",
                cursor: reachable ? "pointer" : "default",
                opacity: reachable || isCurrent ? 1 : 0.45,
              }}
            >
              <span
                className="flex items-center justify-center"
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "var(--radius-pill)",
                  fontSize: 10,
                  fontFamily: "var(--font-mono)",
                  background: isComplete
                    ? "var(--fill-action)"
                    : isCurrent
                      ? "var(--btn-primary-bg)"
                      : "var(--bg-hover)",
                  color: isCurrent
                    ? "var(--btn-primary-fg)"
                    : isComplete
                      ? "var(--text-on-action)"
                      : "var(--text-primary)",
                }}
              >
                {isComplete ? <Check style={{ width: 11, height: 11 }} /> : i + 1}
              </span>
              <span
                style={{
                  fontSize: "var(--type-caption-size)",
                  color: isCurrent ? "var(--text-on-action)" : "var(--text-secondary)",
                  fontWeight: isCurrent ? 500 : 400,
                }}
              >
                {s.title}
                {s.optional && (
                  <span
                    style={{
                      fontSize: 10,
                      color: isCurrent ? "var(--text-on-action)" : "var(--text-muted)",
                    }}
                  >
                    {" "}
                    · optional
                  </span>
                )}
              </span>
            </button>
          </React.Fragment>
        );
      })}
    </nav>
  );
}
