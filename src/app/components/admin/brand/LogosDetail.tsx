import React, { useEffect, useRef, useState } from "react";
import type { BrandAsset } from "@/lib/types";
import { stores } from "@/lib/stores";
import { inUseMessage, templatesUsingSource } from "@/lib/brand/assetUsage";
import { useRouter } from "../../../router";
import { SignedImg } from "../../SignedImg";
import { consumeAddFlow } from "./addFlow";
import {
  logoSurfaces,
  primaryHandoffOnRemove,
  setLogoSurfaces,
  setPrimaryLogo,
  type LogoSurface,
} from "./kitOps";
import type { BrandDraft } from "./kitPlumbing";
import { Button, ChoiceChip, Input, PreviewOverlay, SegmentedControl, Tag } from "../../primitives";
import { AddSlot } from "./primitives/AddSlot";
import { useInPlaceEdit, type InPlaceEdit } from "./primitives/useInPlaceEdit";

const SURFACE_LABELS: Record<LogoSurface, string> = { dark: "Dark", light: "Light" };

/** The Logos page (13:10014): a surface filter in the URL, four columns of
 * proof-plate cards with the edit overlay (PHASE-6 §9 D8), per-surface
 * primaries, everything edited in place on the card (13:10150) and
 * autosaved; Done closes (§9 D2). */
export function LogosDetail({ brand, surface }: { brand: BrandDraft; surface?: LogoSurface }) {
  const { company, draft, commit, assets, refresh, setError } = brand;
  const { navigate } = useRouter();
  const edit = useInPlaceEdit(brand);

  const logos = assets.filter((a) => a.kind === "logo");
  const onSurface = (s: LogoSurface) => logos.filter((l) => logoSurfaces(l).includes(s));
  const filtered = surface ? onSurface(surface) : logos;

  /** The primary shown for a surface: the kit's choice, else the first
   * logo that shows there (the BrandContext fallback, made visible). */
  const primaryFor = (s: LogoSurface): string | undefined =>
    (s === "dark" ? draft.primaryLogoDarkAssetId : draft.primaryLogoLightAssetId) ??
    onSurface(s)[0]?.id;

  const isPrimary = (a: BrandAsset) => logoSurfaces(a).some((s) => primaryFor(s) === a.id);

  const uploadLogo = async (file: File) => {
    if (!company) return;
    try {
      const asset = await stores.brandAssets.upload(company.id, "logo", file, {
        surfaces: ["dark", "light"],
      });
      // The first logo in an empty library is the primary on both
      // surfaces by definition — a kit write, so it goes through commit.
      if (!logos.length) {
        commit({
          primaryLogoDarkAssetId: asset.id,
          primaryLogoLightAssetId: asset.id,
          primaryLogoAssetId: asset.id,
        });
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Logo upload failed.");
    }
  };

  const uploadRef = useRef(uploadLogo);
  uploadRef.current = uploadLogo;
  const addInputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (consumeAddFlow("logos")) {
      addInputRef.current?.click();
    }
  }, []);

  const setFilter = (next?: LogoSurface) =>
    navigate({ name: "brandStudio", category: "logos", surface: next }, { replace: true });

  const segments = [
    { id: "all", label: `All ${logos.length}` },
    { id: "dark", label: `Dark ${onSurface("dark").length}` },
    { id: "light", label: `Light ${onSurface("light").length}` },
  ];

  return (
    <div className="sp-bs-logos-page">
      <SegmentedControl
        aria-label="Filter logos by surface"
        options={segments}
        selectedId={surface ?? "all"}
        onSelect={(id) => setFilter(id === "all" ? undefined : (id as LogoSurface))}
        className="sp-bs-logos-filter"
      />

      <div className="sp-bs-logos">
        {filtered.map((a) =>
          a.id === edit.editingId ? (
            <LogoEditingCard
              key={a.id}
              asset={a}
              logos={logos}
              brand={brand}
              edit={edit}
              primaryFor={primaryFor}
            />
          ) : (
            <button
              key={a.id}
              type="button"
              className="ui-reset ui-ring sp-bs-logo"
              aria-label={`Edit ${a.name}`}
              data-edit-item={a.id}
              onClick={() => edit.start(a.id)}
            >
              <PreviewOverlay decorative className="sp-bs-logo__plate">
                <LogoPlate asset={a} />
              </PreviewOverlay>
              <span className="sp-bs-logo__meta">
                <span className="t-label-l sp-bs-logo__name">{a.name}</span>
                <span className="sp-bs-logo__tags">
                  {isPrimary(a) && <Tag>Primary</Tag>}
                  {logoSurfaces(a).map((s) => (
                    <Tag key={s}>{SURFACE_LABELS[s]}</Tag>
                  ))}
                </span>
              </span>
            </button>
          ),
        )}
        <AddSlot
          label="Add logo"
          detail="SVG or PNG"
          accept="image/*"
          multiple
          onFiles={(files) => {
            for (const f of files) void uploadRef.current(f);
          }}
          style={{ minHeight: 213 }}
        />
      </div>
      {/* The setup strip's "Upload logo" opens the picker straight away. */}
      <input
        ref={addInputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          for (const f of Array.from(e.target.files ?? [])) void uploadRef.current(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/** The proof plate: one half per surface the logo shows on, each on its
 * fixed ground, which never inverts with the theme. */
function LogoPlate({ asset }: { asset: BrandAsset }) {
  return (
    <span className="sp-bs-plate">
      {logoSurfaces(asset).map((s) => (
        <span key={s} className="sp-bs-plate__half" data-plate={s}>
          <SignedImg src={asset.url} alt="" />
        </span>
      ))}
    </span>
  );
}

interface LogoEditingProps {
  asset: BrandAsset;
  logos: BrandAsset[];
  brand: BrandDraft;
  edit: InPlaceEdit;
  primaryFor(s: LogoSurface): string | undefined;
}

function LogoEditingCard({ asset, logos, brand, edit, primaryFor }: LogoEditingProps) {
  const { company, draft, commit, refresh, setError } = brand;
  const rootRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState(asset.name);
  const [note, setNote] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);

  const surfaces = logoSurfaces(asset);

  const saveName = async () => {
    const next = name.trim();
    if (!next || next === asset.name) return;
    try {
      await stores.brandAssets.update(asset.id, { name: next });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : `Couldn't rename ${asset.name}.`);
    }
  };

  const saveNameRef = useRef(saveName);
  saveNameRef.current = saveName;

  const finish = React.useCallback(() => {
    void saveNameRef.current();
    edit.done();
  }, [edit]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      finish();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [finish]);

  const toggleSurface = async (s: LogoSurface, next: boolean) => {
    const nextSet = next ? [...surfaces, s] : surfaces.filter((x) => x !== s);
    const patch = setLogoSurfaces(asset, nextSet);
    if (!patch) {
      setNote("A logo needs at least one surface.");
      return;
    }
    setNote(null);
    try {
      await stores.brandAssets.update(asset.id, { metadata: patch });
      // A primary can't point at a logo that no longer shows on its
      // surface — hand that surface to the next eligible logo, or clear.
      const dropped = surfaces.filter((x) => !patch.surfaces.includes(x));
      const handoff: Partial<typeof draft> = {};
      for (const droppedSurface of dropped) {
        const key =
          droppedSurface === "dark" ? "primaryLogoDarkAssetId" : "primaryLogoLightAssetId";
        if (draft[key] === asset.id) {
          handoff[key] = logos.find(
            (l) => l.id !== asset.id && logoSurfaces(l).includes(droppedSurface),
          )?.id;
        }
      }
      if (Object.keys(handoff).length) {
        const dark =
          "primaryLogoDarkAssetId" in handoff
            ? handoff.primaryLogoDarkAssetId
            : draft.primaryLogoDarkAssetId;
        const light =
          "primaryLogoLightAssetId" in handoff
            ? handoff.primaryLogoLightAssetId
            : draft.primaryLogoLightAssetId;
        commit({ ...handoff, primaryLogoAssetId: dark ?? light });
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : `Couldn't update ${asset.name}.`);
    }
  };

  const makePrimary = (s: LogoSurface) => {
    const patch = setPrimaryLogo(draft, asset, s);
    if (!patch) return;
    const previous = logos.find((l) => l.id === primaryFor(s) && l.id !== asset.id);
    commit(patch, {
      message: previous
        ? `“${asset.name}” is now primary on ${s}, replacing “${previous.name}”`
        : `“${asset.name}” is now primary on ${s}`,
    });
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
      const patch = primaryHandoffOnRemove(
        draft,
        asset.id,
        logos.filter((l) => l.id !== asset.id),
      );
      // Not an undo step: Undo can't bring the file back, so it must not
      // bring back a primary pointing at it either (PHASE-6 §9 D6).
      brand.forgetAsset(asset.id, patch);
      await refresh();
      edit.done();
    } catch (e) {
      setError(e instanceof Error ? e.message : `Couldn't remove ${asset.name}.`);
    }
  };

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label={`Edit ${asset.name}`}
      className="sp-bs-logo"
      data-editing
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          edit.cancel();
        }
      }}
    >
      <span className="sp-bs-logo__plate">
        <LogoPlate asset={asset} />
      </span>

      <div className="sp-bs-logo__fields">
        <Input
          size="sm"
          aria-label="Logo name"
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onBlur={() => void saveName()}
          onKeyDown={(e) => e.key === "Enter" && finish()}
        />

        <div className="sp-bs-choice-row">
          <span id={`${asset.id}-show`} className="t-label-xs sp-bs-choice-row__label">
            Show on
          </span>
          <div role="group" aria-labelledby={`${asset.id}-show`} className="sp-bs-chips">
            {(["dark", "light"] as const).map((s) => (
              <ChoiceChip
                key={s}
                selected={surfaces.includes(s)}
                onClick={() => void toggleSurface(s, !surfaces.includes(s))}
              >
                {SURFACE_LABELS[s]}
              </ChoiceChip>
            ))}
          </div>
          {note && (
            <p className="t-caption-s sp-bs-note" role="status">
              {note}
            </p>
          )}
        </div>

        <div className="sp-bs-choice-row">
          <span id={`${asset.id}-primary`} className="t-label-xs sp-bs-choice-row__label">
            Primary
          </span>
          <div role="group" aria-labelledby={`${asset.id}-primary`} className="sp-bs-chips">
            {(["dark", "light"] as const).map((s) => (
              <ChoiceChip
                key={s}
                selected={primaryFor(s) === asset.id}
                disabled={!surfaces.includes(s)}
                onClick={() => primaryFor(s) !== asset.id && makePrimary(s)}
              >
                On {s}
              </ChoiceChip>
            ))}
          </div>
        </div>

        {blocked && (
          <p className="t-caption-s sp-bs-error-line" role="alert">
            {blocked}
          </p>
        )}

        <div className="sp-bs-popover__foot">
          {/* The file goes, and Undo can't bring it back: red (§9 D6). */}
          <button
            type="button"
            className="ui-reset ui-ring t-label-xs sp-bs-quiet-action"
            data-destructive
            onClick={() => void remove()}
          >
            Remove
          </button>
          <Button kind="primary" size="sm" onClick={finish}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
