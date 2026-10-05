import React, { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import type { BrandAsset } from "@/lib/types";
import { stores } from "@/lib/stores";
import { registerCustomFont } from "@/lib/render/fonts";
import { FONT_ACCEPT, inspectFontFile } from "@/lib/brand/fontUpload";
import { Input, ProgressBar, RowContextMenu, RowMenu, type RowMenuGroup } from "../../primitives";
import { consumeAddFlow } from "./addFlow";
import type { BrandDraft } from "./kitPlumbing";
import { AddSlot } from "./primitives/AddSlot";

/** A font file mid-upload: the row shows the family read from the file and
 * an indeterminate bar, then "Added", then becomes the real row. */
interface PendingFontRow {
  key: string;
  family: string;
  done: boolean;
}

const SPECIMEN = "Your brand, set in this face.";

const familyOf = (asset: BrandAsset): string =>
  (asset.metadata as { family?: string }).family ?? asset.name;

/** The Fonts page (13:13689): the account's library of uploaded font files,
 * one row each (the face, the family over the file's name, a specimen),
 * with Rename, Replace file and Remove on the row menu and on right-click.
 * Which face does which job is set on Type styles (PHASE-6 §9 D3). */
export function FontsDetail({ brand }: { brand: BrandDraft }) {
  const { company, assets, refresh, setError } = brand;
  const fontAssets = assets.filter((a) => a.kind === "font");
  const [pending, setPending] = useState<PendingFontRow[]>([]);

  const uploadFont = async (file: File) => {
    if (!company) return;
    const check = await inspectFontFile(file);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    setError(null);
    const key = `${file.name}-${Date.now()}-${Math.random()}`;
    setPending((prev) => [
      ...prev,
      { key, family: check.metadata.family ?? file.name, done: false },
    ]);
    try {
      const asset = await stores.brandAssets.upload(company.id, "font", file, check.metadata);
      await registerCustomFont(asset); // usable immediately, export-safe
      // "Added" for a moment, then the real row takes its place (§9 D9).
      setPending((prev) => prev.map((p) => (p.key === key ? { ...p, done: true } : p)));
      window.setTimeout(() => {
        setPending((prev) => prev.filter((p) => p.key !== key));
        void refresh();
      }, 900);
    } catch (e) {
      setPending((prev) => prev.filter((p) => p.key !== key));
      setError(e instanceof Error ? e.message : "Font upload failed.");
    }
  };

  const uploadRef = useRef(uploadFont);
  uploadRef.current = uploadFont;
  const addInputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (consumeAddFlow("typography")) addInputRef.current?.click();
  }, []);

  return (
    <section className="sp-bs-list" aria-label="Fonts">
      {(fontAssets.length > 0 || pending.length > 0) && (
        <div className="sp-bs-list__rows">
          {fontAssets.map((a) => (
            <FontRow key={a.id} asset={a} brand={brand} />
          ))}
          {pending.map((p) => (
            <div key={p.key} className="sp-bs-font" data-uploading>
              <span className="sp-bs-font__aa sp-bs-font__aa--pending" aria-hidden>
                Aa
              </span>
              <span className="sp-bs-font__id sp-bs-font__id--pending">
                <span className="t-label-s sp-bs-font__family">{p.family}</span>
                {p.done ? (
                  <span className="t-label-xs sp-bs-font__added" role="status">
                    <Check size={12} className="ui-icon" aria-hidden />
                    Added
                  </span>
                ) : (
                  <ProgressBar label={`Uploading ${p.family}`} />
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      <AddSlot
        label="Add font"
        onFiles={(files) => {
          for (const f of files) void uploadRef.current(f);
        }}
        accept={FONT_ACCEPT}
        multiple
        style={{ minHeight: 56 }}
      />
      {/* The setup strip's add flow opens the picker straight away. */}
      <input
        ref={addInputRef}
        type="file"
        accept={FONT_ACCEPT}
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          for (const f of Array.from(e.target.files ?? [])) void uploadRef.current(f);
          e.target.value = "";
        }}
      />
    </section>
  );
}

/** One uploaded font. Rename changes the label (the file line), never the
 * family that styles and templates match by; Replace file swaps the file
 * and keeps the font, refusing a file of another family; Remove is red, as
 * Undo can't bring a file back, and refused while a type style uses the
 * face (§9 D6). */
function FontRow({ asset, brand }: { asset: BrandAsset; brand: BrandDraft }) {
  const { refresh, setError, draft } = brand;
  const family = familyOf(asset);
  const [renaming, setRenaming] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);
  const replaceRef = useRef<HTMLInputElement>(null);

  const usedBy = draft.typeStyles.filter(
    (s) => s.font?.source === "custom" && (s.font.assetId === asset.id || s.font.family === family),
  );

  const rename = async (raw: string) => {
    setRenaming(false);
    const next = raw.trim();
    if (!next || next === asset.name) return;
    try {
      await stores.brandAssets.update(asset.id, { name: next });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : `Couldn't rename ${asset.name}.`);
    }
  };

  const replace = async (file: File) => {
    const check = await inspectFontFile(file);
    if (!check.ok) {
      setBlocked(check.error);
      return;
    }
    if ((check.metadata.family ?? "") !== family) {
      setBlocked("That file is a different font. Upload it as a new font instead.");
      return;
    }
    setBlocked(null);
    try {
      const next = await stores.brandAssets.replace(asset.id, file, check.metadata);
      await registerCustomFont(next);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : `Couldn't replace ${asset.name}.`);
    }
  };

  const remove = async () => {
    if (usedBy.length) {
      const names = usedBy.map((s) => s.name).join(", ");
      setBlocked(
        `“${family}” is the face of ${names}. Pick a different font in Type styles first, then remove it.`,
      );
      return;
    }
    try {
      await stores.brandAssets.remove(asset.id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : `Couldn't remove ${family}.`);
    }
  };

  const groups: RowMenuGroup[] = [
    {
      items: [
        { label: "Rename", onSelect: () => setRenaming(true) },
        { label: "Replace file", onSelect: () => replaceRef.current?.click() },
      ],
    },
    { items: [{ label: "Remove", destructive: true, onSelect: () => void remove() }] },
  ];
  const label = `More actions for ${family}`;
  const face = { fontFamily: `"${family}", sans-serif` };

  return (
    <div className="sp-bs-font-wrap">
      <RowContextMenu groups={groups} label={label} disabled={renaming}>
        <div className="sp-bs-font">
          <span className="sp-bs-font__aa" style={face} aria-hidden>
            Aa
          </span>
          <span className="sp-bs-font__id">
            <span className="t-label-s sp-bs-font__family">{family}</span>
            {renaming ? (
              <Input
                size="sm"
                aria-label={`Rename ${asset.name}`}
                defaultValue={asset.name}
                autoFocus
                onFocus={(e) => e.target.select()}
                onBlur={(e) => void rename(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                  else if (e.key === "Escape") {
                    e.stopPropagation();
                    setRenaming(false);
                  }
                }}
              />
            ) : (
              <span className="t-label-xs sp-bs-font__file">{asset.name}</span>
            )}
          </span>
          <span className="sp-bs-font__specimen" style={face}>
            {SPECIMEN}
          </span>
          <RowMenu groups={groups} label={label} />
        </div>
      </RowContextMenu>
      <input
        ref={replaceRef}
        type="file"
        accept={FONT_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void replace(file);
        }}
      />
      {blocked && (
        <p className="t-caption-s sp-bs-error-line sp-bs-font__blocked" role="alert">
          {blocked}
        </p>
      )}
    </div>
  );
}
