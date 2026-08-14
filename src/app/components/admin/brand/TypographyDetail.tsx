import React, { useEffect, useRef, useState } from "react";
import { Check, Trash2, Upload } from "lucide-react";
import type { FontRef } from "@/lib/types";
import { stores } from "@/lib/stores";
import { GOOGLE_FONTS, loadGoogleFonts, registerCustomFont } from "@/lib/render/fonts";
import { FONT_ACCEPT, inspectFontFile } from "@/lib/brand/fontUpload";
import { useFileDrop } from "@/lib/useFileDrop";
import { BrandDetailPage } from "./BrandDetailPage";
import { useKitSave } from "./kitPlumbing";

/** A font file mid-upload: chip enters, shimmers, flips to done, leaves. */
interface PendingFontChip {
  key: string;
  name: string;
  done: boolean;
  leaving: boolean;
}

const DEFAULT_HEADING: FontRef = { source: "google", family: "Montserrat" };
const DEFAULT_BODY: FontRef = { source: "google", family: "Inter" };

/** Heading and body faces plus uploaded font files, lifted from the old
 * single-screen Brand Studio. Font uploads land immediately (they are
 * assets, not kit state); the two face choices go through Save. */
export function TypographyDetail() {
  const { company, kit, assets, refresh, saving, saved, error, setError, save } = useKitSave();
  const fontAssets = assets.filter((a) => a.kind === "font");

  const [headingFont, setHeadingFont] = useState<FontRef>(kit?.headingFont ?? DEFAULT_HEADING);
  const [bodyFont, setBodyFont] = useState<FontRef>(kit?.bodyFont ?? DEFAULT_BODY);
  const syncedKitIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!kit || syncedKitIdRef.current === kit.id) return;
    syncedKitIdRef.current = kit.id;
    if (kit.headingFont) setHeadingFont(kit.headingFont);
    if (kit.bodyFont) setBodyFont(kit.bodyFont);
  }, [kit]);

  const dirty =
    JSON.stringify({ headingFont, bodyFont }) !==
    JSON.stringify({
      headingFont: kit?.headingFont ?? DEFAULT_HEADING,
      bodyFont: kit?.bodyFont ?? DEFAULT_BODY,
    });

  const [pendingFonts, setPendingFonts] = useState<PendingFontChip[]>([]);

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

  const fontOptions = (current: FontRef, set: (r: FontRef) => void) => (
    <select
      value={current.source === "custom" ? `custom:${current.assetId}` : `google:${current.family}`}
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
    <BrandDetailPage
      title="Typography"
      description="The heading and body faces new template fields start from, plus your uploaded brand fonts."
      dirty={dirty}
      saving={saving}
      saved={saved}
      saveLabel="Save typography"
      error={error}
      onSave={() => void save({ headingFont, bodyFont })}
    >
      <section className="sp-card sp-card--content space-y-4" style={{ maxWidth: 560 }}>
        <div>
          <label className="sp-eyebrow block mb-1">Heading</label>
          {fontOptions(headingFont, setHeadingFont)}
        </div>
        <div>
          <label className="sp-eyebrow block mb-1">Body</label>
          {fontOptions(bodyFont, setBodyFont)}
        </div>
        <label
          {...fontDrop.bind}
          data-active={fontDrop.active}
          className="sp-dropzone flex items-center justify-center gap-2 py-3 cursor-pointer"
          style={{
            border: "1.5px dashed var(--border-strong)",
            borderRadius: "var(--radius-control)",
            fontSize: "var(--type-label-size)",
            color: "var(--text-secondary)",
          }}
        >
          <Upload className="sp-dropzone__icon w-4 h-4" />
          Upload font file
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
        {pendingFonts.map((p) => (
          <div
            key={p.key}
            className={`${p.leaving ? "sp-chip-out" : "sp-chip-in"} flex items-center gap-2.5 px-3 py-2`}
            style={{
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-control)",
              background: "var(--bg-surface)",
            }}
          >
            <span className="flex-1 min-w-0">
              <span
                className="block truncate"
                style={{
                  fontSize: "var(--type-caption-size)",
                  fontWeight: 500,
                  color: "var(--text-primary)",
                }}
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
        {fontAssets.map((a) => (
          <div key={a.id} className="sp-chip-in flex items-center justify-between text-sm">
            <span
              style={{
                color: "var(--foreground)",
                fontFamily: `"${a.metadata.family ?? a.name}"`,
              }}
            >
              {a.metadata.family ?? a.name}
            </span>
            <button
              onClick={() => void stores.brandAssets.remove(a.id).then(refresh)}
              aria-label={`Remove ${a.name}`}
            >
              <Trash2 className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} />
            </button>
          </div>
        ))}
      </section>
    </BrandDetailPage>
  );
}
