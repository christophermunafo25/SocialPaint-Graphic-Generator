import React, { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import type { BrandAsset, FontRef } from "@/lib/types";
import { stores } from "@/lib/stores";
import { GOOGLE_FONTS, loadGoogleFonts, registerCustomFont } from "@/lib/render/fonts";
import { FONT_ACCEPT, inspectFontFile } from "@/lib/brand/fontUpload";
import { consumeAddFlow } from "./addFlow";
import type { BrandDraft } from "./kitPlumbing";
import { AddSlot } from "./primitives/AddSlot";
import { RowMenu, type RowMenuGroup, type RowMenuHandle } from "./primitives/RowMenu";
import { Tag } from "./primitives/Tag";

type FaceRole = "heading" | "body";

const ROLE_TITLES: Record<FaceRole, string> = { heading: "Heading", body: "Body" };

interface FontRowModel {
  id: string;
  family: string;
  source: "google" | "uploaded";
  roles: FaceRole[];
  asset?: BrandAsset;
}

/** A font file mid-upload: row enters, shimmers, flips to done, leaves. */
interface PendingFontRow {
  key: string;
  name: string;
  done: boolean;
  leaving: boolean;
}

const SPECIMEN = "Your brand, set in this face.";

/** The Fonts page: one full-width card listing the heading face, the body
 * face (one row when they share a family), and uploaded font assets — the
 * N3 boundary: no saved role-less Google list. */
export function FontsDetail({ brand }: { brand: BrandDraft }) {
  const { company, draft, commit, assets, refresh, setError } = brand;
  const fontAssets = assets.filter((a) => a.kind === "font");
  const [pending, setPending] = useState<PendingFontRow[]>([]);

  const heading = draft.headingFont ?? { source: "google" as const, family: "Montserrat" };
  const body = draft.bodyFont ?? { source: "google" as const, family: "Inter" };

  const assetFor = (ref: FontRef): BrandAsset | undefined =>
    ref.source === "custom" ? fontAssets.find((a) => a.id === ref.assetId) : undefined;

  const rows: FontRowModel[] = [];
  if (heading.family === body.family && heading.source === body.source) {
    rows.push({
      id: "faces",
      family: heading.family,
      source: heading.source === "custom" ? "uploaded" : "google",
      roles: ["heading", "body"],
      asset: assetFor(heading),
    });
  } else {
    rows.push({
      id: "heading",
      family: heading.family,
      source: heading.source === "custom" ? "uploaded" : "google",
      roles: ["heading"],
      asset: assetFor(heading),
    });
    rows.push({
      id: "body",
      family: body.family,
      source: body.source === "custom" ? "uploaded" : "google",
      roles: ["body"],
      asset: assetFor(body),
    });
  }
  const listed = new Set(rows.map((r) => r.asset?.id).filter(Boolean));
  for (const a of fontAssets) {
    if (!listed.has(a.id)) {
      rows.push({
        id: a.id,
        family: a.metadata.family ?? a.name,
        source: "uploaded",
        roles: [],
        asset: a,
      });
    }
  }

  const setFace = (role: FaceRole, ref: FontRef) => {
    if (ref.source === "google") loadGoogleFonts([ref.family]);
    commit(role === "heading" ? { headingFont: ref } : { bodyFont: ref }, {
      message: `${ROLE_TITLES[role]} face set to ${ref.family}`,
    });
  };

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
      { key, name: check.metadata.family ?? file.name, done: false, leaving: false },
    ]);
    try {
      const asset = await stores.brandAssets.upload(company.id, "font", file, check.metadata);
      await registerCustomFont(asset); // usable immediately, export-safe
      // Done check, then the row leaves and the real asset row takes over.
      setPending((prev) => prev.map((p) => (p.key === key ? { ...p, done: true } : p)));
      window.setTimeout(() => {
        setPending((prev) => prev.map((p) => (p.key === key ? { ...p, leaving: true } : p)));
        window.setTimeout(() => {
          setPending((prev) => prev.filter((p) => p.key !== key));
          void refresh();
        }, 260);
      }, 700);
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
    <section className="sp-card sp-list-card">
      {rows.map((row) => (
        <FontRow key={row.id} row={row} brand={brand} fontAssets={fontAssets} setFace={setFace} />
      ))}

      {pending.map((p) => (
        <div key={p.key} className={`sp-font-row ${p.leaving ? "sp-chip-out" : "sp-chip-in"}`}>
          <span className="sp-font-row__aa" aria-hidden>
            Aa
          </span>
          <span className="sp-font-row__id">
            <span className="sp-color-card__name block">{p.name}</span>
            {p.done ? (
              <span
                className="sp-done-in flex items-center gap-1 mt-1"
                style={{ fontSize: 10, color: "var(--state-primary)" }}
              >
                <Check style={{ width: 11, height: 11 }} />
                Added
              </span>
            ) : (
              <span className="sp-upload-track block mt-1.5">
                <span className="sp-upload-bar" />
              </span>
            )}
          </span>
        </div>
      ))}

      <AddSlot
        label="Add font"
        onFiles={(files) => {
          for (const f of files) void uploadRef.current(f);
        }}
        accept={FONT_ACCEPT}
        multiple
        style={{ minHeight: 56, marginTop: "var(--space-2xs)" }}
      />
      {/* The setup strip's "Set fonts" opens the picker straight away. */}
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

function FontRow({
  row,
  brand,
  fontAssets,
  setFace,
}: {
  row: FontRowModel;
  brand: BrandDraft;
  fontAssets: BrandAsset[];
  setFace(role: FaceRole, ref: FontRef): void;
}) {
  const { refresh, setError } = brand;
  const menuRef = useRef<RowMenuHandle>(null);
  const [picking, setPicking] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);

  const refFor = (family: string, source: "google" | "uploaded"): FontRef =>
    source === "google"
      ? { source: "google", family }
      : {
          source: "custom",
          family,
          assetId: fontAssets.find((a) => (a.metadata.family ?? a.name) === family)?.id,
        };

  const removeAsset = async () => {
    if (!row.asset) return;
    if (row.roles.length) {
      const which =
        row.roles.length === 2 ? "the heading and body face" : `the ${row.roles[0]} face`;
      setBlocked(`“${row.family}” is ${which}. Pick a different face first, then remove it.`);
      return;
    }
    try {
      await stores.brandAssets.remove(row.asset.id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : `Couldn't remove ${row.family}.`);
    }
  };

  const groups: RowMenuGroup[] = [
    {
      label: "Role",
      items: [
        ...(["heading", "body"] as const).map((role) => ({
          label: ROLE_TITLES[role],
          checked: row.roles.includes(role),
          onSelect: () => setFace(role, refFor(row.family, row.source)),
        })),
        {
          label: "No role",
          checked: row.roles.length === 0,
          // A face always points somewhere — a role leaves a row by being
          // assigned to another family, never by being switched off.
          disabled: row.roles.length > 0,
          onSelect: () => {},
        },
      ],
    },
  ];
  if (row.roles.length) {
    groups.push({ items: [{ label: "Change face…", onSelect: () => setPicking(true) }] });
  }
  if (row.asset) {
    groups.push({
      items: [{ label: "Remove", destructive: true, onSelect: () => void removeAsset() }],
    });
  }

  return (
    <>
      <div
        className="sp-font-row sp-menu-row"
        onContextMenu={(e) => {
          e.preventDefault();
          menuRef.current?.openAt(e.clientX, e.clientY);
        }}
      >
        <span
          className="sp-font-row__aa"
          aria-hidden
          style={{ fontFamily: `"${row.family}", sans-serif` }}
        >
          Aa
        </span>
        <span className="sp-font-row__id">
          <span className="sp-color-card__name block">{row.family}</span>
          <span className="sp-eyebrow">{row.source === "google" ? "Google" : "Uploaded"}</span>
        </span>
        <span
          className="sp-font-row__specimen"
          style={{ fontFamily: `"${row.family}", sans-serif` }}
        >
          {SPECIMEN}
        </span>
        <span className="sp-font-row__tags">
          {row.roles.map((role) => (
            <Tag key={role}>{ROLE_TITLES[role]}</Tag>
          ))}
        </span>
        <RowMenu ref={menuRef} groups={groups} ariaLabel={`More actions for ${row.family}`} />
      </div>
      {blocked && (
        <p
          role="alert"
          style={{
            fontSize: "var(--type-caption-size)",
            color: "var(--state-danger)",
            paddingBottom: "var(--space-2xs)",
          }}
        >
          {blocked}
        </p>
      )}
      {picking && (
        <FacePicker
          uploadedFamilies={fontAssets.map((a) => a.metadata.family ?? a.name)}
          onPick={(family, source) => {
            for (const role of row.roles) setFace(role, refFor(family, source));
            setPicking(false);
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </>
  );
}

/** The "Change face…" combobox: uploaded families first, then the Google
 * list, filtered as you type. */
function FacePicker({
  uploadedFamilies,
  onPick,
  onClose,
}: {
  uploadedFamilies: string[];
  onPick(family: string, source: "google" | "uploaded"): void;
  onClose(): void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const q = query.trim().toLowerCase();
  const options: Array<{ family: string; source: "google" | "uploaded" }> = [
    ...uploadedFamilies
      .filter((f) => f.toLowerCase().includes(q))
      .map((family) => ({ family, source: "uploaded" as const })),
    ...GOOGLE_FONTS.filter((f) => f.toLowerCase().includes(q)).map((family) => ({
      family,
      source: "google" as const,
    })),
  ];
  const clamped = Math.min(active, Math.max(0, options.length - 1));

  return (
    <div className="sp-face-picker">
      <input
        ref={inputRef}
        className="sp-input sp-input--mini"
        role="combobox"
        aria-expanded
        aria-label="Search fonts"
        placeholder="Search fonts"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onClose();
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive(Math.min(clamped + 1, options.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive(Math.max(clamped - 1, 0));
          } else if (e.key === "Enter" && options[clamped]) {
            e.preventDefault();
            onPick(options[clamped].family, options[clamped].source);
          }
        }}
      />
      <div className="sp-face-picker__list" role="listbox" aria-label="Fonts">
        {options.map((o, i) => (
          <button
            key={`${o.source}:${o.family}`}
            type="button"
            role="option"
            aria-selected={i === clamped}
            data-active={i === clamped || undefined}
            className="sp-face-picker__option"
            onMouseEnter={() => setActive(i)}
            onClick={() => onPick(o.family, o.source)}
          >
            {o.family}
            <span className="sp-eyebrow">{o.source === "google" ? "Google" : "Uploaded"}</span>
          </button>
        ))}
        {!options.length && (
          <p
            style={{
              padding: "var(--space-2xs) var(--space-xs)",
              fontSize: "var(--type-caption-size)",
              color: "var(--text-muted)",
            }}
          >
            No faces match.
          </p>
        )}
      </div>
    </div>
  );
}
