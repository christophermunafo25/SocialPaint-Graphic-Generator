import React, { useState } from "react";
import { Check } from "lucide-react";
import type { BrandAsset } from "@/lib/types";
import { SignedImg } from "./SignedImg";

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
                onClick={() => onPickAsset(asset)}
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
      )}
    </div>
  );
}
