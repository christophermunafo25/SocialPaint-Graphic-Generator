import React, { useRef, useState } from "react";
import { ArrowLeft, Check, Images, Upload } from "lucide-react";
import type { BrandAsset } from "@/lib/types";
import { SignedImg } from "./SignedImg";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";

/** The brand assets a picture can come from: logos and any uploaded images. */
export const pickableAssets = (assets: BrandAsset[]): BrandAsset[] =>
  assets.filter((a) => a.kind === "logo" || a.kind === "image");

interface ImageSourceChooserProps {
  /** Brand assets on offer. Empty (or the public page, which has none)
   * renders `device` alone — exactly the control that existed before. */
  assets: BrandAsset[];
  /** The device path: the existing dropzone or upload label, unchanged. */
  device: React.ReactNode;
  onPickAsset(asset: BrandAsset): void;
  /** The asset currently in use, when a brand asset is; ticked in the grid. */
  selectedUrl?: string;
  /** Tighter tiles for the inspector rail. */
  compact?: boolean;
  /** Label the first tab; "Your brand" by default. */
  brandLabel?: string;
}

/** Where a picture comes from: the brand's own assets, or a file on this
 * device. One chooser for every surface that takes an image — the member
 * fill form and the builder's fixed-image inspector — so the two ask the
 * question the same way. The device tab is the default because it is what
 * both surfaces did before; the brand tab is a grid of the logos and images
 * Brand Studio holds. */
export function ImageSourceChooser({
  assets,
  device,
  onPickAsset,
  selectedUrl,
  compact = false,
  brandLabel = "Your brand",
}: ImageSourceChooserProps) {
  const [source, setSource] = useState<"brand" | "device">("device");
  if (assets.length === 0) return <>{device}</>;

  const tabs: Array<{ key: "brand" | "device"; label: string }> = [
    { key: "brand", label: brandLabel },
    { key: "device", label: "This device" },
  ];

  return (
    <div className="space-y-2" style={{ minWidth: 0 }}>
      <div
        role="tablist"
        aria-label="Where the image comes from"
        className="flex overflow-hidden"
        data-radius-control
        style={{ border: "1px solid var(--border-strong)", width: "fit-content" }}
      >
        {tabs.map((t, i) => {
          const on = source === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setSource(t.key)}
              style={{
                padding: compact ? "3px 8px" : "5px 12px",
                fontSize: "var(--type-caption-size)",
                fontWeight: on ? 500 : 400,
                borderLeft: i > 0 ? "1px solid var(--border)" : undefined,
                background: on ? "var(--fill-action)" : "var(--bg-surface)",
                color: on ? "var(--text-on-action)" : "var(--text-secondary)",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {source === "device" ? (
        device
      ) : (
        <BrandAssetGrid
          assets={assets}
          selectedUrl={selectedUrl}
          compact={compact}
          onPick={onPickAsset}
        />
      )}
    </div>
  );
}

/** The brand's logos and images as pickable tiles. */
function BrandAssetGrid({
  assets,
  selectedUrl,
  compact = false,
  onPick,
}: {
  assets: BrandAsset[];
  selectedUrl?: string;
  compact?: boolean;
  onPick(asset: BrandAsset): void;
}) {
  return (
    <div
      role="listbox"
      aria-label="Brand images"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(auto-fill, minmax(${compact ? 64 : 88}px, 1fr))`,
        gap: "var(--space-3xs)",
      }}
    >
      {assets.map((asset) => {
        const name = asset.name.replace(/\.[^.]+$/, "");
        const selected = Boolean(selectedUrl) && asset.url === selectedUrl;
        return (
          <button
            key={asset.id}
            type="button"
            role="option"
            aria-selected={selected}
            title={name}
            onClick={() => onPick(asset)}
            className="flex flex-col items-center gap-1 relative"
            style={{
              padding: compact ? 4 : 6,
              border: selected ? "1px solid var(--state-primary)" : "1px solid var(--border)",
              borderRadius: "var(--radius-control)",
              background: "var(--bg-surface)",
              fontSize: 10.5,
              color: "var(--text-secondary)",
              minWidth: 0,
            }}
          >
            <span
              className="flex items-center justify-center w-full"
              style={{ height: compact ? 36 : 52 }}
            >
              <SignedImg
                src={asset.url}
                alt={name}
                draggable={false}
                style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
              />
            </span>
            <span className="truncate w-full text-center">{name}</span>
            {selected && (
              <Check
                aria-hidden
                style={{
                  position: "absolute",
                  top: 3,
                  right: 3,
                  width: 12,
                  height: 12,
                  color: "var(--state-primary)",
                }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

interface ImageSourceDialogProps {
  open: boolean;
  onClose(): void;
  /** Brand assets on offer. With none, the dialog goes straight to the
   * device path rather than presenting a choice of one. */
  assets: BrandAsset[];
  onPickAsset(asset: BrandAsset): void;
  /** A file chosen from this device. Validation is the caller's — the
   * member form applies its size cap and type list, the builder its own. */
  onPickFile(file: File): void;
  /** The <input type=file> accept list for the device path. */
  accept: string;
  selectedUrl?: string;
  title?: string;
}

/** The replace-image question, asked AFTER the person says they want to
 * replace: a small dialog with two option cards, "Your brand" and "This
 * device". Brand opens the asset grid in place; device opens the native
 * file picker and the dialog closes on a choice. Escape and the overlay
 * dismiss. The first upload on a surface keeps its inline controls — this
 * is for the moment an image already exists and the question is what to
 * swap it for. */
export function ImageSourceDialog({
  open,
  onClose,
  assets,
  onPickAsset,
  onPickFile,
  accept,
  selectedUrl,
  title = "Replace image",
}: ImageSourceDialogProps) {
  const [showingBrand, setShowingBrand] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const close = () => {
    setShowingBrand(false);
    onClose();
  };
  const optionStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "18px 12px",
    border: "1px solid var(--border-strong)",
    borderRadius: "var(--radius-control)",
    background: "var(--bg-surface)",
    color: "var(--text-primary)",
    fontSize: "var(--type-label-size)",
    fontWeight: 500,
    cursor: "pointer",
    textAlign: "center",
  };

  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && close()}>
      <AlertDialogContent
        onOverlayClick={close}
        onEscapeKeyDown={close}
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-card)",
          maxWidth: 440,
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle
            style={{
              fontSize: "var(--type-cardtitle-size)",
              fontWeight: "var(--weight-ui)",
              color: "var(--text-primary)",
            }}
          >
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription
            style={{ fontSize: "var(--type-label-size)", color: "var(--text-secondary)" }}
          >
            {showingBrand
              ? "Pick one of your brand's logos or images."
              : "Where should the new image come from?"}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {showingBrand ? (
          <div className="space-y-3">
            <BrandAssetGrid
              assets={assets}
              selectedUrl={selectedUrl}
              onPick={(asset) => {
                onPickAsset(asset);
                close();
              }}
            />
            <button
              type="button"
              className="sp-btn sp-btn-ghost"
              onClick={() => setShowingBrand(false)}
            >
              <ArrowLeft style={{ width: 14, height: 14 }} />
              Back
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-2xs)" }}>
            {assets.length > 0 && (
              <button type="button" style={optionStyle} onClick={() => setShowingBrand(true)}>
                <Images style={{ width: 20, height: 20, color: "var(--state-primary)" }} />
                Your brand
                <span
                  style={{
                    fontSize: "var(--type-caption-size)",
                    fontWeight: 400,
                    color: "var(--text-muted)",
                  }}
                >
                  {assets.length} {assets.length === 1 ? "image" : "images"}
                </span>
              </button>
            )}
            <button type="button" style={optionStyle} onClick={() => fileRef.current?.click()}>
              <Upload style={{ width: 20, height: 20, color: "var(--state-primary)" }} />
              This device
              <span
                style={{
                  fontSize: "var(--type-caption-size)",
                  fontWeight: 400,
                  color: "var(--text-muted)",
                }}
              >
                Choose a file
              </span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept={accept}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                onPickFile(f);
                close();
              }}
            />
          </div>
        )}

        <div className="flex justify-end">
          <button type="button" className="sp-btn sp-btn-ghost" onClick={close}>
            Cancel
          </button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
