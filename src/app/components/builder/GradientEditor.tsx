import React from "react";
import type { TextGradient } from "@/lib/types";
import { ColorControl } from "../ColorControl";

interface GradientEditorProps {
  gradient: TextGradient | undefined;
  disabled?: boolean;
  /** Checkbox label — "Gradient fill" for text, "Gradient" for the canvas. */
  label?: string;
  /** Default stops when first enabled. */
  defaultStops?: TextGradient["stops"];
  onChange(gradient: TextGradient | undefined): void;
}

/** Linear-gradient editor: toggle, per-stop hex-first color controls, stop
 * positions, and angle. Shared by the text fill and the canvas background. */
export function GradientEditor({
  gradient,
  disabled = false,
  label = "Gradient fill",
  defaultStops = [
    { position: 0, color: "#FF8300" },
    { position: 1, color: "#FF5A72" },
  ],
  onChange,
}: GradientEditorProps) {
  const enabled = Boolean(gradient);
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2" style={{ fontSize: "var(--type-label-size)", color: "var(--text-primary)" }}>
        <input
          type="checkbox"
          disabled={disabled}
          checked={enabled}
          onChange={(e) => onChange(e.target.checked ? { angle: 90, stops: defaultStops } : undefined)}
        />
        {label}
      </label>
      {gradient && (
        <div className="space-y-1.5 pl-5">
          {gradient.stops.map((stop, i) => (
            <div key={i} className="flex items-center gap-2">
              <ColorControl
                ariaLabel={`Gradient stop ${i + 1}`}
                size={24}
                value={stop.color}
                onChange={(color) =>
                  onChange({
                    ...gradient,
                    stops: gradient.stops.map((st, j) => (j === i ? { ...st, color } : st)),
                  })
                }
              />
              <input
                type="number"
                min={0}
                max={100}
                className="sp-input"
                style={{ width: 62, padding: "4px 6px", fontSize: 11 }}
                value={Math.round(stop.position * 100)}
                title="Stop position (%)"
                onChange={(e) =>
                  onChange({
                    ...gradient,
                    stops: gradient.stops.map((st, j) =>
                      j === i ? { ...st, position: Math.min(100, Math.max(0, Number(e.target.value))) / 100 } : st,
                    ),
                  })
                }
              />
              {gradient.stops.length > 2 && (
                <button
                  onClick={() => onChange({ ...gradient, stops: gradient.stops.filter((_, j) => j !== i) })}
                  style={{ fontSize: 11, color: "var(--text-muted)" }}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          <div className="flex items-center gap-3">
            <button
              onClick={() =>
                onChange({ ...gradient, stops: [...gradient.stops, { position: 1, color: "#FFED8C" }] })
              }
              style={{ fontSize: 11, color: "var(--state-primary)" }}
            >
              + Add stop
            </button>
            <label className="flex items-center gap-1.5" style={{ fontSize: 11, color: "var(--text-secondary)" }}>
              Angle
              <input
                type="number"
                className="sp-input"
                style={{ width: 62, padding: "4px 6px", fontSize: 11 }}
                value={gradient.angle}
                onChange={(e) => onChange({ ...gradient, angle: Number(e.target.value) })}
              />
              °
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
