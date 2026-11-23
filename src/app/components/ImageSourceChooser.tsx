import React, { useRef, useState } from "react";
import { ArrowLeft, Check, Images, Upload } from "lucide-react";
import type { BrandAsset } from "@/lib/types";
import { SignedImg } from "./SignedImg";
import { Button, Modal, OptionTile } from "./primitives";

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
      <div role="tablist" aria-label="Where the image comes from" className="sp-tabstrip">
        {tabs.map((t) => {
          const on = source === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setSource(t.key)}
              className="sp-tabstrip__tab"
              style={{
                padding: compact ? "3px 8px" : "5px 12px",
                fontSize: "var(--type-caption-size)",
                fontWeight: on ? 500 : 400,
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
        gap: "var(--space-4)",
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
              border: selected
                ? "1px solid var(--state-primary)"
                : "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-sm)",
              background: "var(--surface-raised)",
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
  /** Where each open starts: the two-option question (the default), or
   * straight on the brand grid, for a caller whose own control already
   * asked (the Generate composer's "Choose from Brand Studio"). Back still
   * reaches the question. With no assets it is always the question. */
  initialView?: "choice" | "brand";
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
  initialView = "choice",
}: ImageSourceDialogProps) {
  const opensOnBrand = initialView === "brand" && assets.length > 0;
  const [showingBrand, setShowingBrand] = useState(opensOnBrand);
  // Every open starts on the initial view, whatever the last one ended on.
  // Adjusted during render on the open edge (not in an effect), so the
  // first painted frame is already the right view.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setShowingBrand(opensOnBrand);
  }
  const fileRef = useRef<HTMLInputElement>(null);
  // Reset to the initial view rather than the question, so a dialog that
  // opened on the grid keeps the grid on screen while it fades out.
  const close = () => {
    setShowingBrand(opensOnBrand);
    onClose();
  };
  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && close()}
      title={title}
      wide
      // Open on the choice: the picked asset (or the first) on the grid, the
      // first option on the question.
      onOpenAutoFocus={(e) => {
        e.preventDefault();
        const content = e.currentTarget as HTMLElement;
        const target =
          content.querySelector<HTMLElement>('[role="option"][aria-selected="true"]') ??
          content.querySelector<HTMLElement>('[role="option"], .ui-option-tile');
        target?.focus({ preventScroll: true });
      }}
    >
      <p className="t-body-m sp-st-confirm__body">
        {showingBrand
          ? "Pick one of your brand's logos or images."
          : "Where should the new image come from?"}
      </p>

      {showingBrand ? (
        <BrandAssetGrid
          assets={assets}
          selectedUrl={selectedUrl}
          onPick={(asset) => {
            onPickAsset(asset);
            close();
          }}
        />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-8)" }}>
          {assets.length > 0 && (
            <OptionTile
              label="Your brand"
              description={`${assets.length} ${assets.length === 1 ? "image" : "images"}`}
              icon={Images}
              selected={false}
              onClick={() => setShowingBrand(true)}
            />
          )}
          <OptionTile
            label="This device"
            description="Choose a file"
            icon={Upload}
            selected={false}
            onClick={() => fileRef.current?.click()}
          />
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

      <div
        className="sp-st-confirm__actions"
        style={showingBrand ? { justifyContent: "space-between" } : undefined}
      >
        {showingBrand && (
          <Button kind="neutral" icon={ArrowLeft} onClick={() => setShowingBrand(false)}>
            Back
          </Button>
        )}
        <Button kind="neutral" onClick={close}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}
