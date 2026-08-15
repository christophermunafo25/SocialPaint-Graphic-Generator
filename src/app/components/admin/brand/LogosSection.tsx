import React from "react";
import { Star, Trash2, Upload } from "lucide-react";
import { stores } from "@/lib/stores";
import { useFileDrop } from "@/lib/useFileDrop";
import { SignedImg } from "../../SignedImg";
import { Disclosure } from "./Disclosure";
import type { BrandDraft } from "./kitPlumbing";

const GLANCE_CAP = 3;

interface SectionProps {
  brand: BrandDraft;
  open: boolean;
  onToggle(): void;
}

/** The logo library. Dropping a logo onto a template copies the artwork's
 * URL onto the field — there is no live binding, so nothing here restyles
 * saved templates. Uploads and removals land immediately (assets, not kit
 * state); the primary marker rides the autosave. */
export function LogosSection({ brand, open, onToggle }: SectionProps) {
  const { company, draft, commit, assets, refresh, setError } = brand;
  const logoAssets = assets.filter((a) => a.kind === "logo");
  const primaryId = draft.primaryLogoAssetId ?? logoAssets[0]?.id;

  const uploadLogo = async (file: File) => {
    if (!company) return;
    try {
      const asset = await stores.brandAssets.upload(company.id, "logo", file);
      // The first logo in an empty library is the primary by definition —
      // that's a kit write, so it goes through commit.
      if (!logoAssets.length) commit({ primaryLogoAssetId: asset.id });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Logo upload failed.");
    }
  };

  const removeLogo = async (id: string, name: string) => {
    try {
      await stores.brandAssets.remove(id);
      // Removing the primary hands the star to whatever is left, so the
      // preview and new work never point at a deleted asset.
      if (draft.primaryLogoAssetId === id) {
        commit({ primaryLogoAssetId: logoAssets.find((a) => a.id !== id)?.id });
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : `Couldn't remove ${name}.`);
    }
  };

  const logoDrop = useFileDrop((files) => {
    for (const f of files) void uploadLogo(f);
  });

  return (
    <Disclosure
      eyebrow={`Files · ${logoAssets.length} logo${logoAssets.length === 1 ? "" : "s"}`}
      title="Logos"
      glance={
        logoAssets.length > 0 && (
          <span className="flex" style={{ gap: 6 }}>
            {logoAssets.slice(0, GLANCE_CAP).map((a) => (
              <span
                key={a.id}
                className="flex items-center justify-center"
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
                  style={{ maxWidth: "78%", maxHeight: "70%", objectFit: "contain" }}
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
          Builders drop these onto templates. The starred one is the default the preview and new
          work reach for.
        </p>

        {logoAssets.length > 0 && (
          <div
            className="grid gap-3.5"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(128px, 1fr))" }}
          >
            {logoAssets.map((a) => {
              const isPrimary = a.id === primaryId;
              return (
                <div key={a.id} className="space-y-1.5">
                  <div
                    className="relative flex items-center justify-center aspect-square p-3"
                    style={{
                      border: `1px solid ${isPrimary ? "var(--editor-accent)" : "var(--border)"}`,
                      borderRadius: "var(--radius-control)",
                    }}
                  >
                    <SignedImg
                      src={a.url}
                      alt={a.name}
                      className="max-w-full max-h-full object-contain"
                    />
                    <button
                      onClick={() =>
                        commit(
                          { primaryLogoAssetId: a.id },
                          { message: `“${a.name}” is now the primary logo` },
                        )
                      }
                      title="Make primary"
                      aria-label={
                        isPrimary ? `${a.name} is the primary logo` : `Make ${a.name} primary`
                      }
                      aria-pressed={isPrimary}
                      className="absolute"
                      style={{ top: 6, right: 6 }}
                    >
                      <Star
                        style={{
                          width: 14,
                          height: 14,
                          color: isPrimary ? "var(--editor-accent)" : "var(--text-muted)",
                        }}
                        fill={isPrimary ? "currentColor" : "none"}
                      />
                    </button>
                    <button
                      onClick={() => void removeLogo(a.id, a.name)}
                      className="absolute"
                      style={{ bottom: 6, right: 6 }}
                      aria-label={`Remove ${a.name}`}
                    >
                      <Trash2 style={{ width: 13, height: 13, color: "var(--text-muted)" }} />
                    </button>
                  </div>
                  <div
                    className="flex justify-between gap-2"
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 10,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      color: "var(--text-muted)",
                    }}
                  >
                    <span className="truncate">{a.name}</span>
                    {isPrimary && (
                      <span style={{ color: "var(--text-secondary)", flexShrink: 0 }}>Primary</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <label
          {...logoDrop.bind}
          data-active={logoDrop.active}
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
          Drop a logo (SVG or PNG), or click to browse
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              for (const f of Array.from(e.target.files ?? [])) void uploadLogo(f);
              e.target.value = "";
            }}
          />
        </label>
      </div>
    </Disclosure>
  );
}
