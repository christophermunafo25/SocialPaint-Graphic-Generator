import React from "react";
import { Minus, Plus, RotateCw } from "lucide-react";
import type { TextGradient } from "@/lib/types";
import { ColorControl } from "../ColorControl";
import { Button, IconButton } from "../primitives";
import { NumericField, SegmentedIconGroup } from "./InspectorControls";
import { RadialFields } from "./FillPicker";

interface GradientEditorProps {
  gradient: TextGradient | undefined;
  disabled?: boolean;
  /** The row's name ("Gradient"). */
  label?: string;
  /** Default stops when first added. */
  defaultStops?: TextGradient["stops"];
  onChange(gradient: TextGradient | undefined): void;
}

/** The canvas background's gradient, as the Blank frame draws it (325:484):
 * its name and Add, then, once added, its kind, a row for each stop (the
 * colour and its position), Add stop and the angle. Numeric entry runs on
 * the inspector's NumericField contract: draft while typing, commit on
 * Enter or blur, revert on Escape or invalid input. */
export function GradientEditor({
  gradient,
  disabled = false,
  label = "Gradient",
  defaultStops = [
    { position: 0, color: "#FF8300" },
    { position: 1, color: "#FF5A72" },
  ],
  onChange,
}: GradientEditorProps) {
  return (
    <div className="sp-insp-group">
      <div className="sp-insp-titled">
        <span className="t-label-s">{label}</span>
        {gradient ? (
          <IconButton
            variant="ghost"
            size="sm"
            icon={Minus}
            label={`Remove the ${label.toLowerCase()}`}
            disabled={disabled}
            onClick={() => onChange(undefined)}
          />
        ) : (
          <Button
            kind="neutral"
            size="sm"
            icon={Plus}
            disabled={disabled}
            aria-label={`Add a ${label.toLowerCase()}`}
            onClick={() => onChange({ angle: 90, stops: defaultStops })}
          >
            Add
          </Button>
        )}
      </div>
      {gradient && (
        <>
          <SegmentedIconGroup
            stretch
            ariaLabel="Gradient kind"
            disabled={disabled}
            value={gradient.kind ?? "linear"}
            options={[
              { key: "linear", label: "Linear", title: "Linear" },
              { key: "radial", label: "Radial", title: "Radial" },
            ]}
            onSelect={(k) =>
              onChange(
                k === "radial"
                  ? { ...gradient, kind: "radial" }
                  : { angle: gradient.angle, stops: gradient.stops },
              )
            }
          />
          {gradient.kind === "radial" && (
            <RadialFields gradient={gradient} disabled={disabled} onChange={onChange} />
          )}
          {gradient.stops.map((stop, i) => (
            <div key={i} className="sp-insp-row__control">
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
              <NumericField
                suffix="%"
                ariaLabel={`Stop ${i + 1} position`}
                precision={0}
                min={0}
                max={100}
                value={Math.round(stop.position * 100)}
                onCommit={(v) =>
                  onChange({
                    ...gradient,
                    stops: gradient.stops.map((st, j) =>
                      j === i ? { ...st, position: (v ?? stop.position * 100) / 100 } : st,
                    ),
                  })
                }
              />
              {gradient.stops.length > 2 && (
                <IconButton
                  variant="ghost"
                  size="sm"
                  icon={Minus}
                  label={`Remove stop ${i + 1}`}
                  onClick={() =>
                    onChange({ ...gradient, stops: gradient.stops.filter((_, j) => j !== i) })
                  }
                />
              )}
            </div>
          ))}
          <div className="sp-insp-row__control">
            <Button
              kind="ghost"
              size="sm"
              icon={Plus}
              onClick={() =>
                onChange({
                  ...gradient,
                  stops: [...gradient.stops, { position: 1, color: "#FFED8C" }],
                })
              }
            >
              Add stop
            </Button>
            {gradient.kind !== "radial" && (
              <NumericField
                icon={<RotateCw size={16} strokeWidth={1.5} aria-hidden />}
                suffix="°"
                ariaLabel="Gradient angle"
                precision={0}
                value={gradient.angle}
                onCommit={(v) =>
                  onChange({ ...gradient, angle: (((v ?? gradient.angle) % 360) + 360) % 360 })
                }
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
