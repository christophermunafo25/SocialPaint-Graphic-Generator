import React from "react";
import { Trash2, Upload } from "lucide-react";
import { stores } from "@/lib/stores";
import { inUseMessage, templatesUsingSource } from "@/lib/brand/assetUsage";
import { useFileDrop } from "@/lib/useFileDrop";
import { downscaleImage } from "@/lib/render/downscaleImage";
import { MAX_UPLOAD_EDGE_PX } from "../../imageUpload";
import { SignedImg } from "../../SignedImg";
import { Disclosure } from "./Disclosure";
import type { BrandDraft } from "./kitPlumbing";

const GLANCE_CAP = 3;

interface SectionProps {
  brand: BrandDraft;
  open: boolean;
  onToggle(): void;
}

/** A brand photo, downscaled before it leaves the browser. A 12MB phone
 * photo would otherwise sit in storage and be pulled into every render as
 * a data URL — the same reason member uploads are downscaled. SVGs and
 * anything already within bounds pass through untouched, name and type
 * intact. */
async function prepareImage(file: File): Promise<File> {
  if (file.type === "image/svg+xml") return file;
  const original = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(file);
  });
  const scaled = await downscaleImage(original, MAX_UPLOAD_EDGE_PX);
  if (scaled === original) return file;
  const blob = await (await fetch(scaled)).blob();
  const ext = blob.type === "image/png" ? "png" : "jpg";
  return new File([blob], file.name.replace(/\.[^.]+$/, "") + `.${ext}`, { type: blob.type });
}

/** The image library: photos and artwork the brand wants on hand — a
 * product shot, a campaign background, a headshot set. Members pick from
 * these on the fill form's "Your brand" tab and builders set them as fixed
 * images, both by reference; nothing here restyles a saved template.
 * Uploads and removals land immediately (assets, not kit state). */
export function ImagesSection({ brand, open, onToggle }: SectionProps) {
  const { company, assets, refresh, setError } = brand;
  const imageAssets = assets.filter((a) => a.kind === "image");

  const uploadImage = async (file: File) => {
    if (!company) return;
    try {
      await stores.brandAssets.upload(company.id, "image", await prepareImage(file));
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Image upload failed.");
    }
  };

  const removeImage = async (id: string, name: string) => {
    try {
      // Same rule as logos: an image a template still paints stays, with
      // the templates named, until it is replaced there.
      const asset = imageAssets.find((a) => a.id === id);
      if (asset && company) {
        const uses = templatesUsingSource(await stores.templates.listAll(company.id), asset.url);
        if (uses.length) {
          setError(inUseMessage(name, uses));
          return;
        }
      }
      await stores.brandAssets.remove(id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : `Couldn't remove ${name}.`);
    }
  };

  const imageDrop = useFileDrop((files) => {
    for (const f of files) void uploadImage(f);
  });

  return (
    <Disclosure
      eyebrow={`Files · ${imageAssets.length} image${imageAssets.length === 1 ? "" : "s"}`}
      title="Images"
      glance={
        imageAssets.length > 0 && (
          <span className="flex" style={{ gap: 6 }}>
            {imageAssets.slice(0, GLANCE_CAP).map((a) => (
              <span
                key={a.id}
                className="flex items-center justify-center overflow-hidden"
                style={{
                  width: 34,
                  height: 24,
                  borderRadius: "var(--radius-control)",
                  border: "1px solid var(--border)",
                }}
              >
                <SignedImg
                  src={a.url}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </span>
            ))}
          </span>
        )
      }
      open={open}
      onToggle={onToggle}
    >
      <div className="space-y-4">
        <p
          style={{
            fontSize: "var(--type-caption-size)",
            color: "var(--text-muted)",
            maxWidth: 480,
          }}
        >
          Photos and artwork your team can pick instead of uploading their own: product shots,
          campaign backgrounds, a headshot set. They appear under “Your brand” wherever a template
          takes a picture.
        </p>

        {imageAssets.length > 0 && (
          <div
            className="grid gap-3.5"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(128px, 1fr))" }}
          >
            {imageAssets.map((a) => (
              <div key={a.id} className="space-y-1.5">
                <div
                  className="relative aspect-square overflow-hidden"
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-control)",
                    background: "var(--bg-hover)",
                  }}
                >
                  {/* Cover, not contain: a photo reads as a photo, and the
                      tile is a thumbnail, not the artwork. */}
                  <SignedImg
                    src={a.url}
                    alt={a.name}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                  <button
                    onClick={() => void removeImage(a.id, a.name)}
                    className="absolute flex items-center justify-center"
                    style={{
                      bottom: 6,
                      right: 6,
                      width: 22,
                      height: 22,
                      borderRadius: "var(--radius-control)",
                      background: "rgba(0,0,0,0.55)",
                    }}
                    aria-label={`Remove ${a.name}`}
                  >
                    <Trash2 style={{ width: 13, height: 13, color: "#fff" }} />
                  </button>
                </div>
                <div
                  className="truncate"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    color: "var(--text-muted)",
                  }}
                >
                  {a.name}
                </div>
              </div>
            ))}
          </div>
        )}

        <label
          {...imageDrop.bind}
          data-active={imageDrop.active}
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
          Drop images (JPG, PNG, or WEBP), or click to browse
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            multiple
            className="hidden"
            onChange={(e) => {
              for (const f of Array.from(e.target.files ?? [])) void uploadImage(f);
              e.target.value = "";
            }}
          />
        </label>
      </div>
    </Disclosure>
  );
}
