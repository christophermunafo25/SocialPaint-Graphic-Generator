import React, { useState } from "react";
import { ChevronDown, ChevronRight, Lock, Plus, Trash2 } from "lucide-react";
import type { BrandColor, BrandTypeStyle, FontRef } from "@/lib/types";
import { GOOGLE_FONTS, loadGoogleFonts } from "@/lib/render/fonts";
import { ruleSentences } from "@/lib/brand/resolveStyle";

interface TypeStylesEditorProps {
  styles: BrandTypeStyle[];
  colors: BrandColor[];
  customFamilies: string[];
  onChange(styles: BrandTypeStyle[]): void;
  /** Blast radius per style key, e.g. "Used by 14 fields in 9 templates";
   * null hides the line (usage not loaded). */
  usageLabelFor?: (key: string) => string | null;
}

const slugKey = (name: string, taken: BrandTypeStyle[]): string => {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "style";
  let key = base;
  let n = 2;
  while (taken.some((s) => s.key === key)) key = `${base}_${n++}`;
  return key;
};

/** The brand rules engine's editor: unlimited named type styles. Every
 * property a style defines becomes an enforced rule — fields bound to the
 * style render with it and end users can't break it. */
export function TypeStylesEditor({ styles, colors, customFamilies, onChange, usageLabelFor }: TypeStylesEditorProps) {
  const [open, setOpen] = useState<string | null>(styles[0]?.key ?? null);

  const update = (key: string, patch: Partial<BrandTypeStyle>) =>
    onChange(styles.map((s) => (s.key === key ? { ...s, ...patch } : s)));

  const kitForRules = { colors } as Parameters<typeof ruleSentences>[1];

  return (
    <div className="space-y-2">
      {styles.map((s) => {
        const expanded = open === s.key;
        const rules = ruleSentences(s, kitForRules);
        return (
          <div key={s.key} style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-card)" }}>
            <button
              className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
              onClick={() => setOpen(expanded ? null : s.key)}
            >
              {expanded ? (
                <ChevronDown style={{ width: 14, height: 14, color: "var(--text-muted)" }} />
              ) : (
                <ChevronRight style={{ width: 14, height: 14, color: "var(--text-muted)" }} />
              )}
              <span style={{ fontSize: "var(--type-label-size)", fontWeight: 500, color: "var(--text-primary)" }}>{s.name}</span>
              {usageLabelFor?.(s.key) && (
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{usageLabelFor(s.key)}</span>
              )}
              <span className="sp-eyebrow ml-auto" style={{ fontSize: 9 }}>
                {rules.length} rule{rules.length !== 1 ? "s" : ""}
              </span>
            </button>

            {!expanded && rules.length > 0 && (
              <div className="px-9 pb-2.5 -mt-1">
                <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{rules.join(" ")}</p>
              </div>
            )}

            {expanded && (
              <div className="px-3 pb-3 space-y-3" style={{ borderTop: "1px solid var(--border)", paddingTop: "var(--space-xs)" }}>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="sp-eyebrow block mb-1">Name</label>
                    <input
                      aria-label="Name"
                      className="sp-input"
                      value={s.name}
                      onChange={(e) => update(s.key, { name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="sp-eyebrow block mb-1">Font</label>
                    <select
                      aria-label="Font"
                      className="sp-input"
                      value={s.font ? `${s.font.source}:${s.font.family}` : ""}
                      onChange={(e) => {
                        if (!e.target.value) return update(s.key, { font: undefined });
                        const [source, ...rest] = e.target.value.split(":");
                        const family = rest.join(":");
                        if (source === "google") loadGoogleFonts([family]);
                        update(s.key, { font: { source, family } as FontRef });
                      }}
                    >
                      <option value="">Not enforced</option>
                      {customFamilies.length > 0 && (
                        <optgroup label="Your uploaded fonts">
                          {customFamilies.map((f) => (
                            <option key={f} value={`custom:${f}`}>{f}</option>
                          ))}
                        </optgroup>
                      )}
                      <optgroup label="Google Fonts">
                        {GOOGLE_FONTS.map((f) => (
                          <option key={f} value={`google:${f}`}>{f}</option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                  <div>
                    <label className="sp-eyebrow block mb-1">Weight</label>
                    <select
                      aria-label="Weight"
                      className="sp-input"
                      value={s.weight ?? ""}
                      onChange={(e) => update(s.key, { weight: e.target.value ? Number(e.target.value) : undefined })}
                    >
                      <option value="">Not enforced</option>
                      {[300, 400, 500, 600, 700, 800].map((w) => (
                        <option key={w} value={w}>{w}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="sp-eyebrow block mb-1">Color</label>
                    <select
                      aria-label="Color"
                      className="sp-input"
                      value={s.colorKey ?? ""}
                      onChange={(e) => update(s.key, { colorKey: e.target.value || undefined })}
                    >
                      <option value="">Not enforced</option>
                      {colors.map((c) => (
                        <option key={c.key} value={c.key}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="sp-eyebrow block mb-1">Fixed size (px)</label>
                    <input
                      type="number"
                      aria-label="Fixed size (px)"
                      className="sp-input"
                      value={s.fontSizePx ?? ""}
                      placeholder="Per template"
                      onChange={(e) => update(s.key, { fontSizePx: e.target.value ? Number(e.target.value) : undefined })}
                    />
                  </div>
                  <div>
                    <label className="sp-eyebrow block mb-1">Max characters</label>
                    <input
                      type="number"
                      aria-label="Max characters"
                      className="sp-input"
                      value={s.maxLength ?? ""}
                      placeholder="No limit"
                      onChange={(e) => update(s.key, { maxLength: e.target.value ? Number(e.target.value) : undefined })}
                    />
                  </div>
                  <div>
                    <label className="sp-eyebrow block mb-1">Letter spacing (px)</label>
                    <input
                      type="number"
                      step="0.1"
                      aria-label="Letter spacing (px)"
                      className="sp-input"
                      value={s.letterSpacingPx ?? ""}
                      placeholder="Not enforced"
                      onChange={(e) =>
                        update(s.key, { letterSpacingPx: e.target.value ? Number(e.target.value) : undefined })
                      }
                    />
                  </div>
                  <div>
                    <label className="sp-eyebrow block mb-1">Line height</label>
                    <input
                      type="number"
                      step="0.05"
                      aria-label="Line height"
                      className="sp-input"
                      value={s.lineHeight ?? ""}
                      placeholder="Not enforced"
                      onChange={(e) => update(s.key, { lineHeight: e.target.value ? Number(e.target.value) : undefined })}
                    />
                  </div>
                  <label className="flex items-center gap-2" style={{ fontSize: "var(--type-label-size)", color: "var(--text-primary)" }}>
                    <input
                      type="checkbox"
                      checked={s.uppercase ?? false}
                      onChange={(e) => update(s.key, { uppercase: e.target.checked || undefined })}
                    />
                    Always uppercase
                  </label>
                  <label className="flex items-center gap-2" style={{ fontSize: "var(--type-label-size)", color: "var(--text-primary)" }}>
                    <input
                      type="checkbox"
                      checked={s.autoFit ?? false}
                      onChange={(e) => update(s.key, { autoFit: e.target.checked || undefined })}
                    />
                    Auto-shrink to fit
                  </label>
                </div>

                {rules.length > 0 && (
                  <div
                    className="rounded-lg px-3 py-2 space-y-0.5"
                    style={{ background: "var(--accent-wash)", border: "1px solid var(--accent-border)" }}
                  >
                    {rules.map((r) => (
                      <p key={r} style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                        <Lock style={{ width: 10, height: 10, display: "inline", marginRight: 5, verticalAlign: "-1px", color: "var(--state-primary)" }} />
                        {r}
                      </p>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => onChange(styles.filter((x) => x.key !== s.key))}
                  className="flex items-center gap-1.5"
                  style={{ fontSize: "var(--type-caption-size)", color: "var(--state-danger)" }}
                >
                  <Trash2 style={{ width: 13, height: 13 }} />
                  Delete style
                </button>
              </div>
            )}
          </div>
        );
      })}

      <button
        onClick={() => {
          const name = `Style ${styles.length + 1}`;
          const key = slugKey(name, styles);
          onChange([...styles, { key, name }]);
          setOpen(key);
        }}
        className="flex items-center gap-1.5"
        style={{ fontSize: "var(--type-caption-size)", color: "var(--state-primary)" }}
      >
        <Plus style={{ width: 13, height: 13 }} />
        Add type style
      </button>
    </div>
  );
}
