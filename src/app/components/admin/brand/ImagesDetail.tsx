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
import {
  Button,
  Input,
  ProgressBar,
  RowContextMenu,
  RowMenu,
  type RowMenuGroup,
} from "../../primitives";
import { AddSlot } from "./primitives/AddSlot";
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

/** A file mid-upload: a card with its name and an indeterminate bar until
 * the asset lands (PHASE-6 §9 D9; the frames draw none, Fonts draws one). */
interface PendingImage {
  key: string;
  name: string;
}

/** The Images page (13:11956): an empty-state drop zone, or four columns of
 * image cards (the plate, the name with its row menu, "JPG · 1200 × 800"),
 * each card's menu also on right-click (§9 D7), then Add images. */
export function ImagesDetail({ brand }: { brand: BrandDraft }) {
  const { company, assets, refresh, setError } = brand;
  const images = assets.filter((a) => a.kind === "image");
  const [pending, setPending] = useState<PendingImage[]>([]);

  const uploadImage = async (file: File) => {
    if (!company) return;
    const key = `${file.name}-${Date.now()}-${Math.random()}`;
    setPending((prev) => [...prev, { key, name: file.name }]);
    try {
      const prepared = await prepareImage(file);
      const size = await readImageSize(prepared);
      await stores.brandAssets.upload(company.id, "image", prepared, size);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Image upload failed.");
    } finally {
      setPending((prev) => prev.filter((p) => p.key !== key));
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

  if (!images.length && !pending.length) {
    return (
      <>
        <div {...drop.bind} data-active={drop.active} className="sp-bs-images-empty">
          <p className="t-label-s">No images yet</p>
          <Button kind="primary" size="lg" onClick={() => addInputRef.current?.click()}>
            Upload images
          </Button>
        </div>
        {hiddenPicker}
      </>
    );
  }

  return (
    <>
      <div className="sp-bs-images">
        {images.map((a) => (
          <ImageCard key={a.id} asset={a} brand={brand} />
        ))}
        {pending.map((p) => (
          <div key={p.key} className="sp-bs-image" data-uploading>
            <span className="sp-bs-image__plate sp-bs-bone" />
            <span className="sp-bs-image__meta">
              <span className="sp-bs-image__row">
                <span className="t-label-s sp-bs-image__name">{p.name}</span>
              </span>
              <ProgressBar label={`Uploading ${p.name}`} />
            </span>
          </div>
        ))}
        <AddSlot
          label="Add images"
          accept={IMAGE_ACCEPT}
          multiple
          onFiles={(files) => {
            for (const f of files) void uploadRef.current(f);
          }}
          style={{ minHeight: 207, alignSelf: "stretch" }}
        />
      </div>
      {hiddenPicker}
    </>
  );
}

/** One image. Rename edits the name in place (Enter or blur saves, Escape
 * cancels); Download and Copy link wait for the signed address; Remove is
 * red (Undo can't bring the file back) and refused while a template uses
 * the image (§9 D6). */
function ImageCard({ asset, brand }: { asset: BrandAsset; brand: BrandDraft }) {
  const { company, refresh, setError } = brand;
  const downloadRef = useRef<HTMLAnchorElement>(null);
  const linkClick = useLinkClick();
  const signed = useSignedUrl(asset.url);
  const [renaming, setRenaming] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);

  // Older assets carry no recorded size: read the natural one from the
  // loaded image, without writing anything back.
  const width = asset.metadata.width ?? natural?.width;
  const height = asset.metadata.height ?? natural?.height;
  const ext = asset.name.split(".").pop()?.toUpperCase() ?? "File";
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
  const label = `More actions for ${asset.name}`;

  return (
    <RowContextMenu groups={groups} label={label} disabled={renaming}>
      <div className="sp-bs-image">
        <span className="sp-bs-image__plate">
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
        <span className="sp-bs-image__meta">
          <span className="sp-bs-image__row">
            {renaming ? (
              <Input
                size="sm"
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
                  else if (e.key === "Escape") {
                    e.stopPropagation();
                    setRenaming(false);
                  }
                }}
              />
            ) : (
              <span className="t-label-s sp-bs-image__name">{asset.name}</span>
            )}
            <RowMenu groups={groups} label={label} />
          </span>
          <span className="t-label-xs sp-bs-image__size">{meta}</span>
          {blocked && (
            <span role="alert" className="sp-bs-image__blocked">
              <span className="t-caption-s sp-bs-error-line">{blocked}</span>
              <a
                href={routeToUrl({ name: "adminTemplates" })}
                onClick={linkClick({ name: "adminTemplates" })}
                className="ui-ring t-label-xs sp-bs-quiet-action"
              >
                Show templates
              </a>
            </span>
          )}
        </span>
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
    </RowContextMenu>
  );
}
