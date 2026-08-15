import React, { useState } from "react";
import { Check, Trash2, Upload } from "lucide-react";
import type { FontRef } from "@/lib/types";
import { stores } from "@/lib/stores";
import { GOOGLE_FONTS, loadGoogleFonts, registerCustomFont } from "@/lib/render/fonts";
import { FONT_ACCEPT, inspectFontFile } from "@/lib/brand/fontUpload";
import { useFileDrop } from "@/lib/useFileDrop";
import { Disclosure } from "./Disclosure";
import type { BrandDraft } from "./kitPlumbing";

/** A font file mid-upload: chip enters, shimmers, flips to done, leaves. */
interface PendingFontChip {
  key: string;
  name: string;
  done: boolean;
  leaving: boolean;
}

const HEADING_SPECIMEN = "Better care, closer to home";
const BODY_SPECIMEN =
  "Same-day appointments across all twelve clinics, with providers who know your name.";

interface SectionProps {
  brand: BrandDraft;
  open: boolean;
  onToggle(): void;
}

/** Heading and body faces, shown as specimens rather than as two dropdowns —
 * the choice is about how the type looks, so the type does the talking.
 * Uploads land immediately (they are assets, not kit state); the two face
 * choices ride the autosave. */
export function TypographySection({ brand, open, onToggle }: SectionProps) {
  const { company, draft, commit, refresh, assets, setError } = brand;
  const fontAssets = assets.filter((a) => a.kind === "font");
  const [pendingFonts, setPendingFonts] = useState<PendingFontChip[]>([]);

  const headingFamily = draft.headingFont?.family ?? "Montserrat";
  const bodyFamily = draft.bodyFont?.family ?? "Inter";

  const uploadFont = async (file: File) => {
    if (!company) return;
    const check = await inspectFontFile(file);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    setError(null);
    const key = `${file.name}-${Date.now()}-${Math.random()}`;
    setPendingFonts((prev) => [
      ...prev,
      { key, name: check.metadata.family ?? file.name, done: false, leaving: false },
    ]);
    try {
      const asset = await stores.brandAssets.upload(company.id, "font", file, check.metadata);
      await registerCustomFont(asset); // usable immediately, export-safe
      // Done check → chip leaves → the real asset row enters in its place.
      setPendingFonts((prev) => prev.map((p) => (p.key === key ? { ...p, done: true } : p)));
      window.setTimeout(() => {
        setPendingFonts((prev) => prev.map((p) => (p.key === key ? { ...p, leaving: true } : p)));
        window.setTimeout(() => {
          setPendingFonts((prev) => prev.filter((p) => p.key !== key));
          void refresh();
        }, 260);
      }, 700);
    } catch (e) {
      setPendingFonts((prev) => prev.filter((p) => p.key !== key));
      setError(e instanceof Error ? e.message : "Font upload failed.");
    }
  };

  const fontDrop = useFileDrop((files) => {
    for (const f of files) void uploadFont(f);
  });

  const facePicker = (current: FontRef | undefined, label: string, set: (r: FontRef) => void) => (
    <select
      aria-label={label}
      value={
        current?.source === "custom"
          ? `custom:${current.assetId}`
          : `google:${current?.family ?? ""}`
      }
      onChange={(e) => {
        const [source, value] = e.target.value.split(":");
        if (source === "google") {
          loadGoogleFonts([value]);
          set({ source: "google", family: value });
        } else {
          const asset = fontAssets.find((a) => a.id === value);
          if (asset)
            set({
              source: "custom",
              family: asset.metadata.family ?? asset.name,
              assetId: asset.id,
            });
        }
      }}
      className="sp-input"
      style={{ maxWidth: 260 }}
    >
      {fontAssets.length > 0 && (
        <optgroup label="Your uploaded fonts">
          {fontAssets.map((a) => (
            <option key={a.id} value={`custom:${a.id}`}>
              {a.metadata.family ?? a.name}
            </option>
          ))}
        </optgroup>
      )}
      <optgroup label="Google Fonts">
        {GOOGLE_FONTS.map((f) => (
          <option key={f} value={`google:${f}`}>
            {f}
          </option>
        ))}
      </optgroup>
    </select>
  );

  return (
    <Disclosure
      eyebrow={
        `Type · 2 faces` +
        (fontAssets.length
          ? ` + ${fontAssets.length} brand font${fontAssets.length === 1 ? "" : "s"}`
          : "")
      }
      title="Typography"
      glance={`${headingFamily} + ${bodyFamily}`}
      open={open}
      onToggle={onToggle}
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-2.5">
            <span className="sp-eyebrow block">Heading face</span>
            <p
              style={{
                fontFamily: `"${headingFamily}", sans-serif`,
                fontWeight: 600,
                fontSize: 26,
                lineHeight: 1.15,
                color: "var(--text-primary)",
                textWrap: "pretty",
              }}
            >
              {HEADING_SPECIMEN}
            </p>
            {facePicker(draft.headingFont, "Heading face", (headingFont) =>
              commit({ headingFont }, { message: `Heading face set to ${headingFont.family}` }),
            )}
          </div>
          <div className="space-y-2.5">
            <span className="sp-eyebrow block">Body face</span>
            <p
              style={{
                fontFamily: `"${bodyFamily}", sans-serif`,
                fontSize: 15,
                lineHeight: 1.5,
                color: "var(--text-secondary)",
                maxWidth: 300,
                textWrap: "pretty",
              }}
            >
              {BODY_SPECIMEN}
            </p>
            {facePicker(draft.bodyFont, "Body face", (bodyFont) =>
              commit({ bodyFont }, { message: `Body face set to ${bodyFont.family}` }),
            )}
          </div>
        </div>

        <div className="space-y-2.5">
          <span className="sp-eyebrow block">Brand fonts</span>
          {pendingFonts.map((p) => (
            <div
              key={p.key}
              className={`${p.leaving ? "sp-chip-out" : "sp-chip-in"} flex items-center gap-2.5 px-3 py-2`}
              style={{
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-control)",
              }}
            >
              <span className="flex-1 min-w-0">
                <span
                  className="block truncate"
                  style={{ fontSize: "var(--type-caption-size)", color: "var(--text-primary)" }}
                >
                  {p.name}
                </span>
                {p.done ? (
                  <span
                    className="sp-done-in flex items-center gap-1 mt-1"
                    style={{ fontSize: 10, color: "var(--state-primary)" }}
                  >
                    <Check style={{ width: 11, height: 11 }} />
                    Added
                  </span>
                ) : (
                  <span className="sp-upload-track block mt-1.5">
                    <span className="sp-upload-bar" />
                  </span>
                )}
              </span>
            </div>
          ))}
          {fontAssets.map((a) => {
            const family = a.metadata.family ?? a.name;
            return (
              <div
                key={a.id}
                className="sp-chip-in flex items-center gap-3"
                style={{ minHeight: 36 }}
              >
                <span
                  className="flex-1 min-w-0 truncate"
                  style={{ fontSize: 14, color: "var(--text-primary)", fontFamily: `"${family}"` }}
                >
                  {family}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    letterSpacing: "0.04em",
                    color: "var(--text-muted)",
                  }}
                >
                  UPLOADED
                </span>
                <button
                  onClick={() => void stores.brandAssets.remove(a.id).then(refresh)}
                  aria-label={`Remove ${family}`}
                >
                  <Trash2 className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} />
                </button>
              </div>
            );
          })}
          <label
            {...fontDrop.bind}
            data-active={fontDrop.active}
            className="sp-dropzone flex flex-col items-center justify-center gap-2 cursor-pointer text-center"
            style={{
              padding: "24px 16px",
              border: "1px dashed var(--border-strong)",
              borderRadius: "var(--radius-control)",
              fontSize: "var(--type-label-size)",
              color: "var(--text-secondary)",
            }}
          >
            <Upload className="sp-dropzone__icon" style={{ width: 18, height: 18 }} />
            Drop font files, or click to browse
            <input
              type="file"
              accept={FONT_ACCEPT}
              multiple
              className="hidden"
              onChange={(e) => {
                for (const f of Array.from(e.target.files ?? [])) void uploadFont(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </div>
    </Disclosure>
  );
}
