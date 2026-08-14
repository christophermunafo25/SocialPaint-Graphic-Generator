import React, { useEffect, useRef, useState } from "react";
import { Star, Trash2, Upload } from "lucide-react";
import { stores } from "@/lib/stores";
import { useFileDrop } from "@/lib/useFileDrop";
import { BrandDetailPage } from "./BrandDetailPage";
import { useKitSave } from "./kitPlumbing";

/** The logo library, lifted from the old single-screen Brand Studio.
 * Dropping a logo onto a template copies the artwork's URL onto the field —
 * there is no live binding, so nothing here restyles saved templates.
 * Uploads and removals land immediately (assets, not kit state); only the
 * primary marker goes through Save. */
export function LogosDetail() {
  const { company, kit, assets, refresh, saving, saved, error, save } = useKitSave();
  const logoAssets = assets.filter((a) => a.kind === "logo");

  const [primaryLogoAssetId, setPrimaryLogoAssetId] = useState(kit?.primaryLogoAssetId);
  const syncedKitIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!kit || syncedKitIdRef.current === kit.id) return;
    syncedKitIdRef.current = kit.id;
    setPrimaryLogoAssetId(kit.primaryLogoAssetId);
  }, [kit]);

  const dirty = primaryLogoAssetId !== kit?.primaryLogoAssetId;

  const uploadLogo = async (file: File) => {
    if (!company) return;
    const asset = await stores.brandAssets.upload(company.id, "logo", file);
    if (!logoAssets.length) setPrimaryLogoAssetId(asset.id);
    await refresh();
  };

  const logoDrop = useFileDrop((files) => {
    if (files[0]) void uploadLogo(files[0]);
  });

  return (
    <BrandDetailPage
      title="Logos"
      description="Every logo builders can drop onto a template. The starred one is the default the preview and new work reach for first."
      dirty={dirty}
      saving={saving}
      saved={saved}
      saveLabel="Save logos"
      error={error}
      onSave={() => void save({ primaryLogoAssetId })}
    >
      <section className="sp-card sp-card--content space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
          {logoAssets.map((a) => (
            <div
              key={a.id}
              className="sp-chip-in relative border p-3 flex items-center justify-center aspect-square"
              style={{
                borderColor: a.id === primaryLogoAssetId ? "var(--state-primary)" : "var(--border)",
                borderRadius: "var(--radius-card)",
              }}
            >
              <img src={a.url} alt={a.name} className="max-w-full max-h-full object-contain" />
              <button
                onClick={() => setPrimaryLogoAssetId(a.id)}
                title="Make primary"
                className="absolute top-1.5 right-1.5"
              >
                <Star
                  className="w-4 h-4"
                  style={{
                    color:
                      a.id === primaryLogoAssetId ? "var(--editor-accent)" : "var(--border-strong)",
                  }}
                  fill={a.id === primaryLogoAssetId ? "currentColor" : "none"}
                />
              </button>
              <button
                onClick={() => void stores.brandAssets.remove(a.id).then(refresh)}
                className="absolute bottom-1.5 right-1.5"
                aria-label={`Remove ${a.name}`}
              >
                <Trash2 className="w-3.5 h-3.5" style={{ color: "var(--muted-foreground)" }} />
              </button>
            </div>
          ))}
          <label
            {...logoDrop.bind}
            data-active={logoDrop.active}
            className="sp-dropzone border-2 border-dashed flex flex-col items-center justify-center aspect-square cursor-pointer gap-1"
            style={{ borderColor: "var(--border)" }}
          >
            <Upload
              className="sp-dropzone__icon w-5 h-5"
              style={{ color: "var(--muted-foreground)" }}
            />
            <span className="sp-eyebrow" style={{ fontSize: 9 }}>
              Add logo
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadLogo(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </section>
    </BrandDetailPage>
  );
}
