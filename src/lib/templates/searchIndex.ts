import type { CatalogTemplate } from "./catalog";

/** Lowercase, strip diacritics, and flatten every separator a member might
 *  type between two numbers or two ratio terms.
 *
 *  The dimension pass runs first and on purpose: `1080x1350` has to become
 *  `1080 1350` while the standalone token `x` — the platform — survives. */
export function normalize(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/(\d)\s*[x×]\s*(\d)/g, "$1 $2")
    .replace(/[:/,·_—–-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(input: string): string[] {
  const n = normalize(input);
  return n ? n.split(" ") : [];
}

/** Typed shorthand → the token actually in the index. Keys are normalized
 *  phrases, so multi-word entries ("linked in") resolve before tokenizing and
 *  never have to survive AND-matching as two useless halves. */
const ALIASES: Array<[string, string]> = [
  ["linked in", "linkedin"],
  ["li", "linkedin"],
  ["ig", "instagram"],
  ["insta", "instagram"],
  ["twitter", "x"],
  ["tweet", "x"],
  ["tweets", "x"],
  ["yt", "youtube"],
  ["shorts", "youtube"],
  ["fb", "facebook"],
  ["tik tok", "tiktok"],
];

/** Longest phrase first, so "linked in" wins over a bare "li". */
const ALIAS_RULES = [...ALIASES].sort((a, b) => b[0].length - a[0].length);

export function applyAliases(normalized: string): string {
  let out = ` ${normalized} `;
  for (const [alias, canonical] of ALIAS_RULES) {
    out = out.split(` ${alias} `).join(` ${canonical} `);
  }
  return out.trim();
}

/** Fields are kept apart so ranking can prefer a name hit over a description
 *  hit without a second pass over the data. */
interface IndexedFields {
  name: string[];
  useCases: string[];
  platform: string[];
  assetType: string[];
  dimensions: string[];
  attributes: string[];
  description: string[];
}

export interface IndexedTemplate {
  template: CatalogTemplate;
  /** Normalized full name, for the exact-match bonus. */
  normalizedName: string;
  fields: IndexedFields;
}

export function buildSearchIndex(templates: CatalogTemplate[]): IndexedTemplate[] {
  return templates.map((t) => ({
    template: t,
    normalizedName: normalize(t.name),
    fields: {
      name: tokenize(t.name),
      useCases: t.useCases.flatMap(tokenize),
      // Both the label and the id, so "web" finds "Web & Open Graph".
      platform: [...tokenize(t.platformLabel), ...t.platforms],
      assetType: tokenize(t.assetType),
      // Every form a member might type: the two numbers, and the ratio.
      dimensions: [String(t.width), String(t.height), ...tokenize(t.aspectRatio)],
      attributes: [t.orientation, ...(t.colorMode ? [t.colorMode] : [])],
      description: tokenize(t.description),
    },
  }));
}

/** Field weights. A name hit should always outrank a description hit, so the
 *  bands are far enough apart that no number of weak hits overtakes a strong
 *  one on a realistic result set. */
const WEIGHTS: Record<keyof IndexedFields, number> = {
  name: 100,
  useCases: 50,
  platform: 30,
  assetType: 30,
  dimensions: 30,
  attributes: 20,
  description: 10,
};

const EXACT_NAME_BONUS = 1000;

/** Prefix, not equality: "carou" should find "carousel". */
const hits = (tokens: string[], query: string): boolean => tokens.some((t) => t.startsWith(query));

/**
 * Token-based AND matching: every token in the query must hit somewhere, so
 * "linkedin carousel" narrows instead of widening. Ranked by where the hits
 * landed. Synchronous and in-memory — the catalogue is one company's
 * published templates, not a corpus.
 */
export function searchTemplates(index: IndexedTemplate[], rawQuery: string): CatalogTemplate[] {
  const query = applyAliases(normalize(rawQuery));
  if (!query) return index.map((i) => i.template);
  const queryTokens = query.split(" ").filter(Boolean);

  const scored: Array<{ template: CatalogTemplate; score: number }> = [];

  for (const entry of index) {
    let score = 0;
    let matchedEvery = true;

    for (const qt of queryTokens) {
      let best = 0;
      for (const field of Object.keys(entry.fields) as Array<keyof IndexedFields>) {
        if (hits(entry.fields[field], qt)) best = Math.max(best, WEIGHTS[field]);
      }
      if (best === 0) {
        matchedEvery = false;
        break;
      }
      score += best;
    }

    if (!matchedEvery) continue;
    if (entry.normalizedName === normalize(rawQuery)) score += EXACT_NAME_BONUS;
    scored.push({ template: entry.template, score });
  }

  // Stable within a score band: newest first, then name, so results never
  // reshuffle between identical queries.
  return scored
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.template.createdAt.localeCompare(a.template.createdAt) ||
        a.template.name.localeCompare(b.template.name),
    )
    .map((s) => s.template);
}
