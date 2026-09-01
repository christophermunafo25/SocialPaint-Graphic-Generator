import React, { useMemo, useState } from "react";
import { Link2, Link2Off } from "lucide-react";
import {
  PLATFORMS,
  aspectRatioOf,
  classifySize,
  orientationOf,
  platformById,
  type CanvasSize,
} from "@/lib/templates/platforms";
import { sameAspect } from "@/lib/templates/rescale";

/** Custom-size bounds. Below 200px nothing legible fits; above 4096px the
 * export path (original + crop + double toPng in memory) stops surviving on
 * mobile Safari — and above 4 megapixels we warn on the way there. */
const MIN_SIDE = 200;
const MAX_SIDE = 4096;
const WARN_MEGAPIXELS = 4_000_000;

/** Validates one custom side. Returns the error naming the bound, or null. */
const sideError = (v: number): string | null => {
  if (!Number.isInteger(v)) return "Whole pixels only.";
  if (v < MIN_SIDE) return `At least ${MIN_SIDE}px per side.`;
  if (v > MAX_SIDE) return `At most ${MAX_SIDE}px per side.`;
  return null;
};

/** The proportional shape swatch: the aspect ratio drawn at a glance, so the
 * admin sees the shape before committing to the numbers. */
function ShapeSwatch({ width, height }: { width: number; height: number }) {
  const box = 22;
  const r = width / height;
  const w = r >= 1 ? box : Math.max(5, Math.round(box * r));
  const h = r >= 1 ? Math.max(5, Math.round(box / r)) : box;
  return (
    <span
      aria-hidden
      className="inline-flex items-center justify-center flex-shrink-0"
      style={{ width: box + 4, height: box + 4 }}
    >
      <span
        style={{
          width: w,
          height: h,
          border: "1.5px solid var(--text-muted)",
          borderRadius: 2,
        }}
      />
    </span>
  );
}

/** Canvas size selection: platform-grouped presets and a custom mode, one
 * control for both creation and (Phase 2) resizing. A size that serves
 * several platforms appears under each of them — that is the catalogue's own
 * behavior, and it is correct.
 *
 * `aspectLock` is the resize-mode constraint: when set, sizes whose aspect
 * differs from the current canvas are not offered in place, and the reason
 * is stated in one line rather than a control being disabled unexplained.
 * With `onPickVersion` those targets stay clickable — they create a new
 * version instead of resizing this template. */
export function CanvasSizePicker({
  sizes,
  value,
  onPick,
  aspectLock,
  onPickVersion,
}: {
  /** The workspace's enabled subset of the size catalogue. */
  sizes: CanvasSize[];
  /** The current canvas size — highlighted in the list, seeds custom mode. */
  value: { width: number; height: number };
  onPick(next: { width: number; height: number }): void;
  /** Resize-in-place restriction: only same-aspect targets are offered, and
   * this one-line reason says why. */
  aspectLock?: { reason: string };
  /** When aspectLock is on, a different-aspect target routes here instead of
   * onPick: it becomes a NEW template version, never an in-place change. */
  onPickVersion?(next: { width: number; height: number }): void;
}) {
  const [tab, setTab] = useState<"presets" | "custom">("presets");
  const [customW, setCustomW] = useState(String(value.width));
  const [customH, setCustomH] = useState(String(value.height));
  /** Aspect link for the custom inputs: typing one side computes the other. */
  const [linked, setLinked] = useState(false);
  const linkRatio = value.width / value.height;

  const groups = useMemo(
    () =>
      // PLATFORMS order is the deliberate shelf order — never by count.
      PLATFORMS.map((p) => ({
        platform: p,
        sizes: sizes.filter((s) => s.platforms.includes(p.id)),
      })).filter((g) => g.sizes.length > 0),
    [sizes],
  );

  const w = Number(customW);
  const h = Number(customH);
  const customErr =
    customW.trim() === "" || customH.trim() === ""
      ? "Enter both sides."
      : Number.isNaN(w) || Number.isNaN(h)
        ? "Numbers only."
        : (sideError(w) ?? sideError(h));
  const customAspectBlocked =
    !customErr && aspectLock && !sameAspect(value, { width: w, height: h });
  const customMeaning = customErr ? null : classifySize(w, h);

  /** How a target applies: in place, as a new version, or not at all. */
  const modeFor = (s: { width: number; height: number }): "inPlace" | "version" | "blocked" =>
    !aspectLock || sameAspect(value, s) ? "inPlace" : onPickVersion ? "version" : "blocked";

  return (
    <div className="space-y-2" style={{ minWidth: 280 }}>
      <div
        role="tablist"
        className="flex overflow-hidden"
        data-radius-control
        style={{ border: "1px solid var(--border-strong)" }}
      >
        {(["presets", "custom"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className="flex-1 px-3 py-1.5"
            style={{
              fontSize: "var(--type-label-size)",
              borderLeft: t === "custom" ? "1px solid var(--border)" : undefined,
              ...(tab === t
                ? { background: "var(--fill-action)", color: "var(--text-on-action)" }
                : { background: "var(--bg-surface)", color: "var(--text-secondary)" }),
            }}
          >
            {t === "presets" ? "Platform sizes" : "Custom"}
          </button>
        ))}
      </div>

      {aspectLock && (
        <p style={{ fontSize: "var(--type-caption-size)", color: "var(--text-secondary)" }}>
          {aspectLock.reason}
        </p>
      )}

      {tab === "presets" ? (
        <div className="space-y-3" style={{ maxHeight: 360, overflowY: "auto", paddingRight: 2 }}>
          {groups.map(({ platform, sizes: groupSizes }) => (
            <div key={platform.id}>
              <p className="sp-eyebrow flex items-center gap-1.5" style={{ marginBottom: 4 }}>
                <platform.Icon style={{ width: 12, height: 12 }} />
                {platform.label}
              </p>
              <div className="space-y-0.5">
                {groupSizes.map((s) => {
                  const current = s.width === value.width && s.height === value.height;
                  const mode = modeFor(s);
                  return (
                    <button
                      key={s.id}
                      onClick={() => {
                        if (mode === "inPlace") onPick({ width: s.width, height: s.height });
                        else if (mode === "version")
                          onPickVersion?.({ width: s.width, height: s.height });
                      }}
                      disabled={mode === "blocked"}
                      aria-pressed={current}
                      className="w-full flex items-center gap-2 px-2 py-1.5 text-left"
                      data-radius-control
                      style={{
                        border: `1px solid ${current ? "var(--border-strong)" : "transparent"}`,
                        background: current ? "var(--bg-inset)" : "transparent",
                        opacity: mode === "blocked" ? 0.45 : 1,
                        cursor: mode === "blocked" ? "default" : "pointer",
                      }}
                    >
                      <ShapeSwatch width={s.width} height={s.height} />
                      <span className="min-w-0 flex-1">
                        <span
                          className="block truncate"
                          style={{
                            fontSize: "var(--type-label-size)",
                            color: "var(--text-primary)",
                          }}
                        >
                          {s.assetType}
                        </span>
                        <span
                          className="block"
                          style={{
                            fontSize: "var(--type-caption-size)",
                            color: "var(--text-muted)",
                          }}
                        >
                          {s.width}×{s.height} · {aspectRatioOf(s.width, s.height)}
                        </span>
                      </span>
                      {mode === "version" && (
                        <span
                          className="sp-eyebrow flex-shrink-0"
                          style={{ color: "var(--state-primary)" }}
                        >
                          new version
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            {(
              [
                ["Width", customW, setCustomW, (side: number) => side / linkRatio, setCustomH],
                ["Height", customH, setCustomH, (side: number) => side * linkRatio, setCustomW],
              ] as const
            ).map(([label, val, setVal, other, setOther]) => (
              <label key={label} className="flex-1">
                <span className="sp-eyebrow block" style={{ marginBottom: 2 }}>
                  {label}
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={MIN_SIDE}
                  max={MAX_SIDE}
                  value={val}
                  onChange={(e) => {
                    setVal(e.target.value);
                    const n = Number(e.target.value);
                    if (linked && Number.isFinite(n) && n > 0)
                      setOther(String(Math.round(other(n))));
                  }}
                  className="w-full px-2 py-1.5"
                  data-radius-control
                  style={{
                    border: "1px solid var(--border-strong)",
                    background: "var(--bg-surface)",
                    fontSize: "var(--type-label-size)",
                    color: "var(--text-primary)",
                  }}
                />
              </label>
            ))}
            <button
              onClick={() => setLinked((v) => !v)}
              aria-pressed={linked}
              title={linked ? "Unlock the aspect ratio" : "Lock the aspect ratio while typing"}
              aria-label={linked ? "Unlock the aspect ratio" : "Lock the aspect ratio"}
              className="sp-icon-btn flex-shrink-0"
              style={{ marginTop: 16, color: linked ? "var(--state-primary)" : undefined }}
            >
              {linked ? (
                <Link2 style={{ width: 15, height: 15 }} />
              ) : (
                <Link2Off style={{ width: 15, height: 15 }} />
              )}
            </button>
          </div>

          {/* Live verdicts: the ratio and orientation as they type, and the
              platform classification so a custom number that lands on a known
              size says so. */}
          <p style={{ fontSize: "var(--type-caption-size)", color: "var(--text-secondary)" }}>
            {customErr ??
              `${aspectRatioOf(w, h)} · ${orientationOf(w, h)}${
                customMeaning && customMeaning.assetType !== "Custom size"
                  ? ` · ${customMeaning.platforms
                      .map((p) => platformById(p).label)
                      .join(" · ")} ${customMeaning.assetType}`
                  : ""
              }`}
          </p>
          {!customErr && w * h > WARN_MEGAPIXELS && (
            <p style={{ fontSize: "var(--type-caption-size)", color: "var(--text-secondary)" }}>
              Over 4 megapixels — exporting a canvas this large can run a phone browser out of
              memory.
            </p>
          )}
          {customAspectBlocked && (
            <p style={{ fontSize: "var(--type-caption-size)", color: "var(--text-secondary)" }}>
              {onPickVersion
                ? "That changes the aspect ratio, so it becomes a new version."
                : "That changes the aspect ratio, so it can’t apply here."}
            </p>
          )}
          <button
            onClick={() => {
              if (customErr) return;
              if (customAspectBlocked) onPickVersion?.({ width: w, height: h });
              else onPick({ width: w, height: h });
            }}
            disabled={Boolean(customErr) || Boolean(customAspectBlocked && !onPickVersion)}
            className="sp-btn w-full"
            style={{ minHeight: 30 }}
          >
            {customErr
              ? "Use custom size"
              : customAspectBlocked && onPickVersion
                ? `Create a ${w}×${h} version`
                : `Use ${w}×${h}`}
          </button>
        </div>
      )}
    </div>
  );
}
