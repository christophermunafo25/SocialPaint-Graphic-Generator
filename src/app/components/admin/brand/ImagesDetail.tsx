import React, { useEffect, useRef, useState } from "react";
import type { BrandAsset } from "@/lib/types";
import { stores } from "@/lib/stores";
import { inUseMessage, templatesUsingSource } from "@/lib/brand/assetUsage";
import { useFileDrop } from "@/lib/useFileDrop";
import { useSignedUrl } from "@/lib/render/useSignedUrl";
import { downscaleImage } from "@/lib/render/downscaleImage";
import { routeToUrl } from "../../../router";
import { MAX_UPLOAD_EDGE_PX } from "../../imageUpload";
import { consumeAddFlow } from "./addFlow";
import type { BrandDraft } from "./kitPlumbing";
import { AddSlot } from "./primitives/AddSlot";
import { RowMenu, type RowMenuGroup, type RowMenuHandle } from "./primitives/RowMenu";
import { useLinkClick } from "./useLinkClick";

const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,image/svg+xml";

/** A brand photo, downscaled before it leaves the browser — same reason
 * member uploads are downscaled. SVGs and anything within bounds pass
 * through untouched, name and type intact. */
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

/** The natural pixel size of an upload, recorded into metadata for the
 * card's meta line. SVGs have no fixed raster size — recorded as nothing. */
const readImageSize = (file: File): Promise<{ width?: number; height?: number }> =>
  new Promise((resolve) => {
    if (file.type === "image/svg+xml") return resolve({});
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({});
    };
    img.src = url;
  });

/** The Images page: an empty-state drop zone, or the four-column library —
 * image cards keep a row menu (D9), never an overlay. */
export function ImagesDetail({ brand }: { brand: BrandDraft }) {
  const { company, assets, refresh, setError } = brand;
  const images = assets.filter((a) => a.kind === "image");

  const uploadImage = async (file: File) => {
    if (!company) return;
    try {
      const prepared = await prepareImage(file);
      const size = await readImageSize(prepared);
      await stores.brandAssets.upload(company.id, "image", prepared, size);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Image upload failed.");
    }
  };

  const uploadRef = useRef(uploadImage);
  uploadRef.current = uploadImage;
  const addInputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (consumeAddFlow("images")) addInputRef.current?.click();
  }, []);

  const drop = useFileDrop((files) => {
    for (const f of files) void uploadRef.current(f);
  });

  const hiddenPicker = (
    <input
      ref={addInputRef}
      type="file"
      accept={IMAGE_ACCEPT}
      multiple
      className="sr-only"
      tabIndex={-1}
      aria-hidden
      onChange={(e) => {
        for (const f of Array.from(e.target.files ?? [])) void uploadRef.current(f);
        e.target.value = "";
      }}
    />
  );

  if (!images.length) {
    return (
      <>
        <div {...drop.bind} data-active={drop.active} className="sp-images-empty">
          <p
            style={{
              fontFamily: "var(--font-ui)",
              fontWeight: "var(--weight-ui)" as React.CSSProperties["fontWeight"],
              fontSize: "var(--type-label-size)",
              color: "var(--text-primary)",
            }}
          >
            No images yet
          </p>
          <p
            style={{
              fontSize: "var(--type-caption-size)",
              color: "var(--text-muted)",
              maxWidth: 360,
            }}
          >
            Drop JPG, PNG, or SVG files here. Large photos are resized before upload.
          </p>
          <button
            className="sp-btn sp-btn-primary"
            style={{ marginTop: "var(--space-2xs)" }}
            onClick={() => addInputRef.current?.click()}
          >
            Upload images
          </button>
        </div>
        {hiddenPicker}
      </>
    );
  }

  return (
    <>
      <div className="sp-logos-grid">
        {images.map((a) => (
          <ImageCard key={a.id} asset={a} brand={brand} />
        ))}
        <AddSlot
          label="Add images"
          accept={IMAGE_ACCEPT}
          multiple
          onFiles={(files) => {
            for (const f of files) void uploadRef.current(f);
          }}
          style={{ minHeight: 132, alignSelf: "stretch" }}
        />
      </div>
      {hiddenPicker}
    </>
  );
}

function ImageCard({ asset, brand }: { asset: BrandAsset; brand: BrandDraft }) {
  const { company, refresh, setError } = brand;
  const menuRef = useRef<RowMenuHandle>(null);
  const downloadRef = useRef<HTMLAnchorElement>(null);
  const linkClick = useLinkClick();
  const signed = useSignedUrl(asset.url);
  const [renaming, setRenaming] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);

  // Older assets carry no recorded size — read the natural one from the
  // loaded image, without writing anything back.
  const width = asset.metadata.width ?? natural?.width;
  const height = asset.metadata.height ?? natural?.height;
  const ext = asset.name.split(".").pop()?.toUpperCase() ?? "FILE";
  const meta = width && height ? `${ext} · ${width} × ${height}` : ext;

  const rename = async (next: string) => {
    if (!next || next === asset.name) return;
    try {
      await stores.brandAssets.update(asset.id, { name: next });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : `Couldn't rename ${asset.name}.`);
    }
  };

  const copyLink = async () => {
    if (!signed.url) return;
    try {
      await navigator.clipboard.writeText(signed.url);
    } catch {
      setError("Couldn't copy the link.");
    }
  };

  const remove = async () => {
    try {
      if (company) {
        const uses = templatesUsingSource(await stores.templates.listAll(company.id), asset.url);
        if (uses.length) {
          setBlocked(inUseMessage(asset.name, uses));
          return;
        }
      }
      await stores.brandAssets.remove(asset.id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : `Couldn't remove ${asset.name}.`);
    }
  };

  const groups: RowMenuGroup[] = [
    {
      items: [
        { label: "Rename", onSelect: () => setRenaming(true) },
        {
          label: "Download",
          disabled: !signed.url,
          onSelect: () => downloadRef.current?.click(),
        },
        { label: "Copy link", disabled: !signed.url, onSelect: () => void copyLink() },
      ],
    },
    { items: [{ label: "Remove", destructive: true, onSelect: () => void remove() }] },
  ];

  return (
    <div
      className="sp-card sp-logo-card sp-menu-row"
      style={{ cursor: "default" }}
      onContextMenu={(e) => {
        e.preventDefault();
        menuRef.current?.openAt(e.clientX, e.clientY);
      }}
    >
      <span className="sp-image-card__plate">
        {signed.url && (
          <img
            src={signed.url}
            alt={asset.name}
            onLoad={(e) => {
              if (!asset.metadata.width) {
                setNatural({
                  width: e.currentTarget.naturalWidth,
                  height: e.currentTarget.naturalHeight,
                });
              }
            }}
          />
        )}
      </span>
      <span className="sp-color-card__row">
        {renaming ? (
          <input
            className="sp-input sp-input--mini"
            aria-label={`Rename ${asset.name}`}
            defaultValue={asset.name}
            autoFocus
            onFocus={(e) => e.target.select()}
            onBlur={(e) => {
              void rename(e.target.value.trim());
              setRenaming(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              else if (e.key === "Escape") setRenaming(false);
            }}
          />
        ) : (
          <span className="sp-color-card__name">{asset.name}</span>
        )}
        <RowMenu ref={menuRef} groups={groups} ariaLabel={`More actions for ${asset.name}`} />
      </span>
      <span className="sp-eyebrow" style={{ padding: "0 var(--space-3xs)" }}>
        {meta}
      </span>
      {blocked && (
        <div
          role="alert"
          className="flex flex-col items-start"
          style={{ gap: "var(--space-3xs)", padding: "0 var(--space-3xs)" }}
        >
          <span style={{ fontSize: "var(--type-caption-size)", color: "var(--state-danger)" }}>
            {blocked}
          </span>
          <a
            href={routeToUrl({ name: "adminTemplates" })}
            onClick={linkClick({ name: "adminTemplates" })}
            className="sp-btn sp-btn-tertiary"
            style={{ height: 24, padding: "0 6px", fontSize: "var(--type-caption-size)" }}
          >
            Show templates
          </a>
        </div>
      )}
      {/* The real download anchor the menu item clicks. */}
      <a
        ref={downloadRef}
        href={signed.url ?? "#"}
        download={asset.name}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
      >
        Download {asset.name}
      </a>
    </div>
  );
}
