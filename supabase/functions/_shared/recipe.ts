// The recipe grammar: `role · kind · key=value · ...`, the way a designer
// keys a layer's name so an import (and, later, a reference or a skeleton)
// knows what the layer is for. Pure: no I/O and no Deno globals, so it runs
// in the Edge Functions and under vitest alike.
//
// A name that doesn't parse is an unkeyed layer, never an error. Kinds and
// keys this vocabulary doesn't know are kept and listed, so a newer file
// imports today and its report says what was not read.

/** Element kinds, from the skeleton library and the frames keyed so far. */
export const RECIPE_KINDS = [
  "group",
  "container",
  "shape",
  "image",
  "text",
  "logo",
  "icon",
  "sticker",
  "plate",
  "outline-plate",
  "pill",
  "outline-pill",
  "rule",
  "mark",
  "tile",
  "scrim",
] as const;

/** Keys an import reads or reports. */
export const RECIPE_KEYS = [
  "edit",
  "max",
  "lines",
  "align",
  "fit",
  "fill",
  "text",
  "color",
  "variant",
  "surface",
  "shape",
  "crop",
  "subject",
  "points",
] as const;

const KNOWN_KINDS: ReadonlySet<string> = new Set(RECIPE_KINDS);
const KNOWN_KEYS: ReadonlySet<string> = new Set(RECIPE_KEYS);

export interface ParsedLayerName {
  role: string;
  kind: string;
  /** Every `key=value` segment, known or not, in the order written. A key
   * written twice keeps its last value. */
  keys: Record<string, string>;
  /** False when the kind isn't in RECIPE_KINDS. */
  knownKind: boolean;
  /** Keys that aren't in RECIPE_KEYS. */
  unknownKeys: string[];
  /** Segments after the kind that aren't `key=value`. */
  stray: string[];
}

const WORD = /^[a-z][a-z0-9-]*$/;
const PAIR = /^([a-z][a-z0-9-]*)=(.+)$/;

/** A layer name read as `role · kind · key=value · ...`, or null when it
 * isn't keyed. A keyed name has a lowercase role and kind, and either a kind
 * this vocabulary knows or at least one `key=value`: "Sign in · Light" and
 * "price · monthly" are ordinary names. */
export function parseLayerName(name: string): ParsedLayerName | null {
  const parts = name.split("·").map((s) => s.trim());
  if (parts.length < 2) return null;
  const [role, kind, ...rest] = parts;
  if (!WORD.test(role) || !WORD.test(kind)) return null;
  const keys: Record<string, string> = {};
  const stray: string[] = [];
  for (const segment of rest) {
    const m = PAIR.exec(segment);
    if (m) keys[m[1]] = m[2].trim();
    else if (segment) stray.push(segment);
  }
  const knownKind = KNOWN_KINDS.has(kind);
  if (!knownKind && Object.keys(keys).length === 0) return null;
  return {
    role,
    kind,
    keys,
    knownKind,
    unknownKeys: Object.keys(keys).filter((k) => !KNOWN_KEYS.has(k)),
    stray,
  };
}

/** What a keyed layer declares, read from its keys into typed values. A
 * value outside a key's vocabulary is left out and named in `invalid`. */
export interface DeclaredIntent {
  role: string;
  kind: string;
  edit?: "member" | "fixed";
  max?: number;
  lines?: number;
  align?: "left" | "center" | "right";
  fit?: "cover" | "contain";
  /** Colour roles (reported, not stored: brand-system Phase 6). */
  fill?: string;
  text?: string;
  color?: string;
  /** Logo keys. */
  variant?: string;
  surface?: "light" | "dark";
  /** Reported as written: the walk reads masks and crops from Figma. */
  shape?: string;
  crop?: string;
  subject?: string;
  points?: string;
  /** `key=value` pairs whose value isn't one the key takes. */
  invalid: string[];
}

const wholeNumber = (v: string): number | undefined =>
  /^[1-9][0-9]{0,3}$/.test(v) ? Number(v) : undefined;

export function declaredIntentOf(parsed: ParsedLayerName): DeclaredIntent {
  const k = parsed.keys;
  const out: DeclaredIntent = { role: parsed.role, kind: parsed.kind, invalid: [] };
  const oneOf = <T extends string>(key: string, allowed: readonly T[]): T | undefined => {
    const v = k[key];
    if (v === undefined) return undefined;
    if ((allowed as readonly string[]).includes(v)) return v as T;
    out.invalid.push(`${key}=${v}`);
    return undefined;
  };
  const count = (key: string): number | undefined => {
    const v = k[key];
    if (v === undefined) return undefined;
    const n = wholeNumber(v);
    if (n === undefined) out.invalid.push(`${key}=${v}`);
    return n;
  };
  out.edit = oneOf("edit", ["member", "fixed"] as const);
  out.max = count("max");
  out.lines = count("lines");
  out.align = oneOf("align", ["left", "center", "right"] as const);
  out.fit = oneOf("fit", ["cover", "contain"] as const);
  out.surface = oneOf("surface", ["light", "dark"] as const);
  for (const key of [
    "fill",
    "text",
    "color",
    "variant",
    "shape",
    "crop",
    "subject",
    "points",
  ] as const) {
    if (k[key] !== undefined) out[key] = k[key];
  }
  for (const key of Object.keys(out) as Array<keyof DeclaredIntent>) {
    if (out[key] === undefined) delete out[key];
  }
  return out;
}

/** Roles whose plain reading isn't their label. */
const ROLE_LABELS: Record<string, string> = {
  cta: "Call to action",
  "photo-fill": "Photo",
};

/** Suffixes that say how a layer is built, not what it is. */
const BUILD_SUFFIX = /-(fill|shape|group|text|image)$/;

/** A role as a field label, in sentence case: "headline" reads "Headline",
 * "photo-fill" reads "Photo", "divider-tag" reads "Divider tag". */
export function roleLabel(role: string): string {
  const bare = role.replace(BUILD_SUFFIX, "") || role;
  const known = ROLE_LABELS[role] ?? ROLE_LABELS[bare];
  if (known) return known;
  const words = bare.replace(/-/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** How much of a tree is keyed, and what the vocabulary didn't know. */
export interface ParseReport {
  /** Visible layers under the root. */
  layers: number;
  keyed: number;
  kinds: Record<string, number>;
  /** "kind (layer name)" and "key (layer name)", once per distinct pair. */
  unknownKinds: string[];
  unknownKeys: string[];
  /** "key=value (layer name)" for values a key doesn't take, and segments
   * that aren't `key=value`. */
  invalid: string[];
}

interface NamedNode {
  name: string;
  visible?: boolean;
  children?: NamedNode[];
}

/** Parse every visible layer under `root` (the root itself is the frame,
 * whose name is the template's, not a layer's). */
export function parseTree(root: NamedNode): ParseReport {
  const report: ParseReport = {
    layers: 0,
    keyed: 0,
    kinds: {},
    unknownKinds: [],
    unknownKeys: [],
    invalid: [],
  };
  const once = (list: string[], entry: string) => {
    if (!list.includes(entry)) list.push(entry);
  };
  const visit = (node: NamedNode) => {
    if (node.visible === false) return;
    report.layers += 1;
    const parsed = parseLayerName(node.name);
    if (parsed) {
      report.keyed += 1;
      report.kinds[parsed.kind] = (report.kinds[parsed.kind] ?? 0) + 1;
      if (!parsed.knownKind) once(report.unknownKinds, `${parsed.kind} (${node.name})`);
      for (const key of parsed.unknownKeys) once(report.unknownKeys, `${key} (${node.name})`);
      for (const bad of [...declaredIntentOf(parsed).invalid, ...parsed.stray]) {
        once(report.invalid, `${bad} (${node.name})`);
      }
    }
    for (const child of node.children ?? []) visit(child);
  };
  for (const child of root.children ?? []) visit(child);
  return report;
}
