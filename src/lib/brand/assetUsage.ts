// Where a storage object is used across a company's templates, and which
// objects a template depends on. Pure string logic over the domain types —
// no client, no signing — so both Brand Studio's delete guard and the
// public-link dialog's "will this link open" check are testable and agree.

import type { TemplateSchema } from "../types";
import { parseStorageRef, type StorageRef } from "../stores/storageRef";

export interface AssetDependency {
  ref: StorageRef;
  /** The persisted source string, exactly as the template carries it. */
  source: string;
  /** What the admin would recognise: "background", a fixed element's
   * label, or a variation's name and the element it swaps. */
  label: string;
}

const key = (ref: StorageRef) => `${ref.bucket}/${ref.path}`;

/** Every storage object a template paints: its background, each fixed
 * image element, and each variation's background and fixed-image swaps.
 * Member-filled image slots are not here — those are data URLs cropped in
 * the filler's own browser. Deduplicated by object; the first label wins. */
export function templateAssetDependencies(template: TemplateSchema): AssetDependency[] {
  const out = new Map<string, AssetDependency>();
  const add = (source: string | undefined, label: string) => {
    if (!source) return;
    const ref = parseStorageRef(source);
    if (!ref) return;
    const k = key(ref);
    if (!out.has(k)) out.set(k, { ref, source, label });
  };
  add(template.backgroundUrl, "background");
  for (const f of template.fields) {
    if (f.type === "image" && f.static) add(f.staticValue, f.label);
  }
  for (const v of template.variants ?? []) {
    add(v.backgroundUrl, `${v.name} background`);
    for (const [fieldKey, over] of Object.entries(v.overrides ?? {})) {
      if (over.staticValue === undefined) continue;
      const field = template.fields.find((f) => f.fieldKey === fieldKey);
      if (field?.type === "image" && field.static) {
        add(over.staticValue, `${v.name} · ${field.label}`);
      }
    }
  }
  return [...out.values()];
}

export interface AssetUse {
  template: TemplateSchema;
  /** Where on the template, in the admin's terms. */
  labels: string[];
}

/** The templates that paint a given source (a brand asset's url, say),
 * with where on each. Empty means the object is safe to delete. */
export function templatesUsingSource(templates: TemplateSchema[], source: string): AssetUse[] {
  const wanted = parseStorageRef(source);
  if (!wanted) return [];
  const wantedKey = key(wanted);
  const uses: AssetUse[] = [];
  for (const template of templates) {
    const labels = templateAssetDependencies(template)
      .filter((d) => key(d.ref) === wantedKey)
      .map((d) => d.label);
    if (labels.length) uses.push({ template, labels });
  }
  return uses;
}

/** "“Logo.svg” is on 2 templates (Tech Talk, We're hiring). Replace it there
 * first, then remove it." */
export function inUseMessage(assetName: string, uses: AssetUse[]): string {
  const names = uses.map((u) => u.template.name);
  const shown = names.slice(0, 3).join(", ") + (names.length > 3 ? ", …" : "");
  return `“${assetName}” is on ${names.length} ${names.length === 1 ? "template" : "templates"} (${shown}). Replace it there first, then remove it.`;
}
