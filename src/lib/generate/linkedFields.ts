// The editor panel's fields (PROMPT.md §9.5): one form for every draft in a
// turn. A turn's drafts are usually the same post in several sizes, filled
// from different templates, so the "Location" on the Instagram draft and
// the "Location" on the LinkedIn draft are one fact. The editor shows it
// once, and an edit writes it to every draft that has it ("Edits update
// both sizes."). Pure and unit-tested: the panel renders the entries, and
// the chat controller applies the edits (chatReducer's valuesEdited).
//
// The rules, in order:
//
//  - Only member fields take part: text, multiline and select fields that
//    are not static. Fixed elements are the admin's, shapes are design
//    only, and image slots are listed on their own (below).
//  - A field joins a group that shares its fieldKey; failing that, one
//    whose label reads the same once lowercased and stripped to letters and
//    digits ("Event date" and "event-date:"). A label with no letter or
//    digit in it links by key alone, so two unlabelled fields are never
//    linked by their emptiness.
//  - A select only joins a select with the identical option list, in the
//    same order, and never a text field: a value one select offers may not
//    be an option of the other.
//  - A group holds at most one field per draft. Linking is across sizes:
//    two fields of one template are two boxes on one graphic, and the fill
//    page shows them as two inputs, so the editor does too. Within a draft,
//    keys are matched before labels, so a draft whose "headline" field is
//    labelled "Subhead" still links by its key, and its field labelled
//    "Headline" under another key starts a group of its own.
//  - Order and label come from the first draft's form, then the fields only
//    later drafts have, in their form order. A group's placeholder is its
//    first member's that has one.
//  - A group is multiline when any member is: a single-line input strips
//    line breaks from its value, which would cost a multiline member its
//    breaks on the first edit, while a break typed into the textarea
//    renders as a space in a single-line member (white-space: nowrap).
//  - required: true when any member is required, by isRequiredField
//    (templates/fieldRules.ts), the one requiredness the codebase reads.
//    TemplateField.required is legacy data nothing reads (see tryNext.ts).
//    Today that makes every member field required, so the editor's
//    "Optional" tag never shows; the plumbing is here for the day a field
//    can be optional. (§9.4 rule 1 asks for optional fields that cannot
//    exist yet; that conflict is with CJ.)
//  - maxLength: the smallest cap across the members, each member's cap the
//    one the fill page enforces (resolveFieldStyle, so a brand type style's
//    "never exceeds N characters" counts). The input can then never take a
//    value one of the sizes refuses. An edit is never cut to fit: a value
//    that already runs past a smaller cap (each size was filled on its own)
//    is written as the member left it, since a value cut mid-word is worse
//    than one that runs long (the generator's own rule). Selects carry no
//    cap: their values are the admin's options.
//  - Image slots are not linked: each is a box of its own shape, cropped to
//    its own aspect. The slot a draft's photo fills (imageTargetFor, when
//    the turn had a photo) is left out, because the photo is already there
//    and never becomes a draft value (draftView.previewValues). Every other
//    member image slot is listed after the text groups, in draft order,
//    empty or not: an entry that vanished on upload could not be replaced
//    or re-cropped. With more than one draft, each is labelled with the
//    size it belongs to, "Headshot · Instagram" (sizeNames, below).
//  - A draft whose template is gone (schema null) cannot be edited. It
//    takes no part and does not count as a size.

import type { BrandKit, TemplateField } from "../types";
import { resolveFieldStyle } from "../brand/resolveStyle";
import { isRequiredField } from "../templates/fieldRules";
import { aspectRatioOf } from "../templates/platforms";
import type { ChatDraft, ChatPhoto } from "./chat";
import { draftName, imageTargetFor, platformLabelFor, tally } from "./draftView";

/** One draft's field in a group. */
export interface LinkedMember {
  draftId: string;
  fieldKey: string;
}

/** A text, multiline or select field shared by one or more drafts. */
export interface LinkedTextGroup {
  kind: "text";
  /** Stable while the drafts are, unique in the list: "text:<draftId>:<fieldKey>"
   * of the first member. A valid HTML id; CSS.escape it for a selector. */
  id: string;
  label: string;
  required: boolean;
  /** The smallest cap across the members; absent when none has one. */
  maxLength?: number;
  type: "text" | "multiline" | "select";
  /** A select's options, identical for every member. */
  options?: string[];
  placeholder?: string;
  /** In draft order: the first is the draft the label came from. */
  members: LinkedMember[];
}

/** One draft's image slot. */
export interface LinkedImageEntry {
  kind: "image";
  /** "image:<draftId>:<fieldKey>", as for a text group. */
  id: string;
  /** The slot's label, with its size when the turn has more than one:
   * "Headshot · Instagram". */
  label: string;
  draftId: string;
  /** The slot as the template defines it (its own label, its aspect). */
  field: TemplateField;
}

export type LinkedEntry = LinkedTextGroup | LinkedImageEntry;

export type LinkedEdit = { draftId: string; fieldKey: string; value: string };

/** A label as fields are linked by it: lowercase, letters and digits only.
 * Empty for a label with neither, which links nothing. tryNext.ts's rule 1
 * uses this too, so the field its "Add a …" chip names is always one the
 * editor links the same way (findGroupForField finds it). */
export const labelKey = (label: string): string =>
  label.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

/** A field a group can hold: text, multiline or select. */
type LinkableField = TemplateField & { type: LinkedTextGroup["type"] };

/** A member field the editor links: text, multiline or select, not static. */
const isLinkable = (f: TemplateField): f is LinkableField =>
  !f.static && (f.type === "text" || f.type === "multiline" || f.type === "select");

/** A member image slot. */
const isMemberImage = (f: TemplateField): f is TemplateField => !f.static && f.type === "image";

/** A draft's fields that `keep` takes, in form order, the first of each
 * fieldKey only: values are keyed by fieldKey, so a repeat would be a
 * second input for the same value. */
function fieldsOf<T extends TemplateField>(
  fields: TemplateField[],
  keep: (f: TemplateField) => f is T,
): T[] {
  const seen = new Set<string>();
  const kept: T[] = [];
  for (const f of fields) {
    if (!keep(f) || seen.has(f.fieldKey)) continue;
    seen.add(f.fieldKey);
    kept.push(f);
  }
  return kept;
}

/** A cap the input can enforce: a positive number. A zero or a stray value
 * would make the group unfillable in every size, so it is not a cap. */
const validCap = (n: number | undefined): n is number =>
  typeof n === "number" && Number.isFinite(n) && n > 0;

/** The cap the fill page enforces for `field` (TemplateFill): the bound
 * type style's maxLength, or the field's own, as the kit's precedence has it. */
function effectiveCap(field: TemplateField, kit: BrandKit | null): number | undefined {
  const cap = resolveFieldStyle(field, kit).maxLength ?? field.maxLength;
  return validCap(cap) ? cap : undefined;
}

const sameOptions = (a: string[] | undefined, b: string[] | undefined): boolean => {
  const x = a ?? [];
  const y = b ?? [];
  return x.length === y.length && x.every((o, i) => o === y[i]);
};

/** A group while it is being built. */
interface Building {
  group: LinkedTextGroup;
  /** Every member's fieldKey and label key, so a later draft links to any. */
  keys: Set<string>;
  labels: Set<string>;
}

/** Whether `field` may join `b` at all: selects only with selects of the
 * same options, text and multiline with each other. */
function compatible(b: Building, field: TemplateField): boolean {
  const selects = (b.group.type === "select") === (field.type === "select");
  return selects && (field.type !== "select" || sameOptions(b.group.options, field.options));
}

/** A new group, named after `field` (its first member, added next). */
function startGroup(draftId: string, field: LinkableField): Building {
  return {
    group: {
      kind: "text",
      id: `text:${draftId}:${field.fieldKey}`,
      label: field.label,
      required: false,
      type: field.type,
      ...(field.type === "select" ? { options: [...(field.options ?? [])] } : {}),
      members: [],
    },
    keys: new Set(),
    labels: new Set(),
  };
}

function addMember(b: Building, draftId: string, field: TemplateField, kit: BrandKit | null): void {
  const g = b.group;
  g.members.push({ draftId, fieldKey: field.fieldKey });
  b.keys.add(field.fieldKey);
  const key = labelKey(field.label);
  if (key) b.labels.add(key);
  if (isRequiredField(field)) g.required = true;
  if (field.type === "multiline") g.type = "multiline";
  if (g.placeholder === undefined && field.placeholder?.trim()) g.placeholder = field.placeholder;
  if (g.type === "select") return;
  const cap = effectiveCap(field, kit);
  if (cap !== undefined && (g.maxLength === undefined || cap < g.maxLength)) g.maxLength = cap;
}

/** The drafts the editor can edit: those whose template is still there. */
const editable = (drafts: ChatDraft[]) =>
  drafts.filter((d): d is ChatDraft & { schema: NonNullable<ChatDraft["schema"]> } => !!d.schema);

/** `labels` with every label that occurs more than once renamed by `rename`
 * (given the label, its index and its place among the labels it ties with,
 * counting from 1); the rest as they are. */
function renameTies(
  labels: string[],
  rename: (label: string, index: number, n: number) => string,
): string[] {
  const counts = tally(labels);
  const seen = new Map<string, number>();
  return labels.map((l, i) => {
    if ((counts.get(l) ?? 0) < 2) return l;
    const n = (seen.get(l) ?? 0) + 1;
    seen.set(l, n);
    return rename(l, i, n);
  });
}

/** The name each draft's size goes by in the editor, distinct across
 * `drafts`, in their order. The editor names a size in two places, and both
 * come from here so they can never disagree:
 *
 *  - The size switch (`ratio: "always"`): "Instagram · 4:5", the draft's
 *    platform (platformLabelFor) and aspect ratio, or the template name for
 *    a size that belongs to no platform ("Now hiring · 1:1").
 *  - An image slot's suffix (`ratio: "onTie"`): "Headshot · Instagram", the
 *    platform (or template name) alone. Sizes that tie add their aspect
 *    ratio ("Instagram · 4:5" and "Instagram · 9:16", the switch's own
 *    labels).
 *
 * Sizes that still tie (one platform and ratio twice, which is every draft
 * of a turn made for one size) are numbered in order: "Instagram 1",
 * "Instagram 2". Not their template names: a segment of a three-way switch
 * shows about 100px of its label, and names the model gave one run tend to
 * share their start ("Product launch", "Product launch (new)"), so they
 * would clip to the same visible text. The number comes first to be seen,
 * and the switch keeps the template name in each segment's tooltip
 * (sizeTitle). A numbered name that meets another draft's (a template named
 * "Instagram 1") is numbered again, so every name reads differently. */
export function sizeNames(drafts: ChatDraft[], opts: { ratio: "always" | "onTie" }): string[] {
  const base = (d: ChatDraft) => platformLabelFor(d.canvas) ?? draftName(d);
  const withRatio = (d: ChatDraft) =>
    `${base(d)} · ${aspectRatioOf(d.canvas.width, d.canvas.height)}`;
  let labels = drafts.map(opts.ratio === "always" ? withRatio : base);
  if (opts.ratio === "onTie") labels = renameTies(labels, (_l, i) => withRatio(drafts[i]));
  labels = renameTies(labels, (_l, i, n) => `${base(drafts[i])} ${n}`);
  return renameTies(labels, (l, _i, n) => `${l} ${n}`);
}

/** A size's whole name, the size switch's tooltip for its segment (and so
 * the segment's accessible description): the design's name, then its size,
 * "Now hiring · Instagram · 4:5", or "Poster · 1:1" for a size that belongs
 * to no platform. A segment's own label can be short of it ("Instagram 1",
 * sizeNames) or clipped by a narrow segment. */
export function sizeTitle(draft: ChatDraft): string {
  const platform = platformLabelFor(draft.canvas);
  const ratio = aspectRatioOf(draft.canvas.width, draft.canvas.height);
  return platform
    ? `${draftName(draft)} · ${platform} · ${ratio}`
    : `${draftName(draft)} · ${ratio}`;
}

/** The slot each draft's photo fills (imageTargetFor), by draft id: the
 * `photoTargets` buildLinkedFields leaves out. Null for every draft when the
 * turn had no photo (a reopened chat never has one), so the slot is listed
 * and the member can fill it. */
export function photoTargetsFor(
  drafts: ChatDraft[],
  photo: ChatPhoto | null | undefined,
): Record<string, string | null> {
  const targets: Record<string, string | null> = {};
  for (const d of drafts) {
    targets[d.id] = photo && d.schema ? imageTargetFor(d.proposal, d.schema) : null;
  }
  return targets;
}

/** The editor's entries for a turn's drafts (the rules in the header): the
 * linked text groups in form order, then the image slots. */
export function buildLinkedFields(
  drafts: ChatDraft[],
  opts: { kit: BrandKit | null; photoTargets: Record<string, string | null> },
): LinkedEntry[] {
  const sizes = editable(drafts);
  const groups: Building[] = [];

  for (const draft of sizes) {
    const fields = fieldsOf(draft.schema.fields, isLinkable);

    // Keys first, then labels, then new groups, so a key match is never
    // lost to a label match on another field of the same draft.
    const placed = new Map<LinkableField, Building>();
    const taken = new Set<Building>();
    const join = (field: LinkableField, matches: (b: Building) => boolean) => {
      const b = groups.find((g) => !taken.has(g) && compatible(g, field) && matches(g));
      if (!b) return;
      placed.set(field, b);
      taken.add(b);
    };
    for (const f of fields) join(f, (b) => b.keys.has(f.fieldKey));
    for (const f of fields) {
      const key = labelKey(f.label);
      if (!placed.has(f) && key) join(f, (b) => b.labels.has(key));
    }
    for (const f of fields) {
      let b = placed.get(f);
      if (!b) {
        b = startGroup(draft.id, f);
        groups.push(b);
      }
      addMember(b, draft.id, f, opts.kit);
    }
  }

  const labels = sizes.length > 1 ? sizeNames(sizes, { ratio: "onTie" }) : null;
  const images: LinkedImageEntry[] = [];
  sizes.forEach((draft, i) => {
    const photoSlot = opts.photoTargets[draft.id] ?? null;
    for (const field of fieldsOf(draft.schema.fields, isMemberImage)) {
      if (field.fieldKey === photoSlot) continue;
      images.push({
        kind: "image",
        id: `image:${draft.id}:${field.fieldKey}`,
        label: labels ? `${field.label} · ${labels[i]}` : field.label,
        draftId: draft.id,
        field,
      });
    }
  });

  return [...groups.map((b) => b.group), ...images];
}

/** The members of an entry: a group's fields, or an image slot's one. */
const membersOf = (entry: LinkedEntry): LinkedMember[] =>
  entry.kind === "text"
    ? entry.members
    : [{ draftId: entry.draftId, fieldKey: entry.field.fieldKey }];

/** The value an entry's input shows. For a group: `preferDraftId`'s own
 * value when that draft is a member, blank or not (pass the draft the
 * preview shows, so the input reads exactly what the graphic above it
 * paints and Download PNG exports: an empty field there is empty here, and
 * shows the template's placeholder, as the graphic does). Without a member
 * to prefer, the first member's with a value: each size was filled on its
 * own, so members can differ until the first edit. When every member is
 * blank, the first member's value, or "" when it has none. */
export function groupValue(
  entry: LinkedEntry,
  drafts: ChatDraft[],
  preferDraftId?: string,
): string {
  const byId = new Map(drafts.map((d) => [d.id, d]));
  const values = membersOf(entry).flatMap((m) => {
    const draft = byId.get(m.draftId);
    return draft ? [{ draftId: m.draftId, value: draft.values[m.fieldKey] ?? "" }] : [];
  });
  const own = values.find((v) => v.draftId === preferDraftId);
  if (own) return own.value;
  return values.find((v) => v.value.trim())?.value ?? values[0]?.value ?? "";
}

/** The edits that set an entry to `value`: one per member, so a group
 * writes every draft that has the field (chatReducer's valuesEdited takes
 * them as they are). The value is never cut to a member's cap; see the
 * header. */
export function editsFor(entry: LinkedEntry, value: string): LinkedEdit[] {
  return membersOf(entry).map((m) => ({ draftId: m.draftId, fieldKey: m.fieldKey, value }));
}

/** The entry that edits `fieldKey` of draft `draftId`, if the editor lists
 * it: how Try next's "Add a location" (a draft and a field) finds the input
 * to focus. Undefined for a field the editor does not show (a fixed one, or
 * the slot the photo fills). */
export function findGroupForField(
  entries: LinkedEntry[],
  draftId: string,
  fieldKey: string,
): LinkedEntry | undefined {
  return entries.find((e) =>
    membersOf(e).some((m) => m.draftId === draftId && m.fieldKey === fieldKey),
  );
}

/** The field to hand FieldInput for an entry, so its guardrails and its
 * spoken name are the entry's. An image slot is the template's field (its
 * aspect, for the crop) under the entry's label. A group is one of its
 * members' real fields, dressed as the group: its label, type, smallest cap,
 * options and placeholder (FieldInput reads nothing else of a text field
 * but its requiredness). The member is one that isRequiredField counts as
 * required when the group is required, else the first, so the control's
 * aria-required always says what the group's `required` (the "Optional"
 * tag) says. Without `drafts` to find the members in, the group's fields
 * are built from the entry alone and read as required. */
export function inputField(entry: LinkedEntry, drafts: ChatDraft[] = []): TemplateField {
  if (entry.kind === "image") return { ...entry.field, label: entry.label };
  const byId = new Map(drafts.map((d) => [d.id, d]));
  const memberFields = entry.members.flatMap((m) => {
    const f = byId.get(m.draftId)?.schema?.fields.find((x) => x.fieldKey === m.fieldKey);
    return f && isLinkable(f) ? [f] : [];
  });
  const representative =
    (entry.required ? memberFields.find((f) => isRequiredField(f)) : undefined) ?? memberFields[0];
  const {
    maxLength: _cap,
    options: _options,
    placeholder: _placeholder,
    ...rest
  }: Partial<TemplateField> = representative ?? {};
  return {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    ...rest,
    id: entry.id,
    fieldKey: entry.members[0]?.fieldKey ?? entry.id,
    label: entry.label,
    type: entry.type,
    ...(entry.maxLength !== undefined ? { maxLength: entry.maxLength } : {}),
    ...(entry.options ? { options: entry.options } : {}),
    ...(entry.placeholder !== undefined ? { placeholder: entry.placeholder } : {}),
  };
}
