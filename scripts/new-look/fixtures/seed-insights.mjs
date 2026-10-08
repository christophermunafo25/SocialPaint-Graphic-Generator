// Seeds the dev workspace fixture with Insights data (PHASE-8.md §9 D13):
// about 60 days of usage events, members and public links, relative to a
// pinned clock that shots.mjs also uses, so the rolling windows hold still
// between runs. Deterministic (a fixed-seed generator); rerunning it writes
// the same data.
//
//   node scripts/new-look/fixtures/seed-insights.mjs
//
// On the 30-day view at the pinned clock every chip state is present:
// Exports up, Opens down, Posted to LinkedIn new (none in the previous
// window), Active members flat. Acme Studios content only (PLAN decision 6).

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(here, "dev-workspace.json");

/** The screenshots' "now": Tuesday 6 Oct 2026, noon in Chicago. */
export const PINNED_CLOCK = "2026-10-06T17:00:00.000Z";
const NOW = Date.parse(PINNED_CLOCK);
const DAY = 86_400_000;

// mulberry32: small, fixed-seed, good enough for sample data.
let seed = 0x5eed1;
const rand = () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = (xs) => xs[Math.floor(rand() * xs.length)];
const weighted = (pairs) => {
  const total = pairs.reduce((n, [, w]) => n + w, 0);
  let r = rand() * total;
  for (const [v, w] of pairs) if ((r -= w) <= 0) return v;
  return pairs[pairs.length - 1][0];
};

const fixture = JSON.parse(await readFile(file, "utf8"));
const db = fixture.localStorage["brand-portal-dev-db"];
const companyId = db.companies[0].id;
const templates = db.templates.filter((t) => t.companyId === companyId);
const byName = Object.fromEntries(templates.map((t) => [t.name, t.id]));

const MEMBERS = [
  {
    userId: "member-jordan",
    email: "jordan@acmestudios.example",
    name: "Jordan Ellis",
    role: "admin",
  },
  { userId: "member-sam", email: "sam@acmestudios.example", name: "Sam Okafor", role: "admin" },
  {
    userId: "member-riley",
    email: "riley@acmestudios.example",
    name: "Riley Chen",
    role: "member",
  },
  { userId: "member-alex", email: "alex@acmestudios.example", name: "Alex Moreno", role: "member" },
  {
    userId: "member-taylor",
    email: "taylor@acmestudios.example",
    name: "Taylor Brooks",
    role: "member",
  },
  {
    userId: "member-casey",
    email: "casey@acmestudios.example",
    name: "Casey Nguyen",
    role: "member",
  },
  {
    userId: "member-morgan",
    email: "morgan@acmestudios.example",
    name: "Morgan Reyes",
    role: "member",
  },
];
// The same five are active in both 30-day windows: Active members is flat.
const ACTIVE = MEMBERS.slice(0, 5).map((m) => m.userId);

const LINKS = [
  {
    id: "link-newsletter",
    name: "Newsletter readers",
    template: "Event promo",
    token: "tok_newsletter_readers_sample",
    days: 40,
  },
  {
    id: "link-speakers",
    name: "Speaker confirmations",
    template: "Product launch",
    token: "tok_speaker_confirmations_sample",
    days: 35,
  },
  {
    id: "link-partners",
    name: "Partner kit",
    template: "Partnership announcement",
    token: "tok_partner_kit_sample",
    days: 25,
  },
  // Made before links stored their token (migration 0033): not copyable.
  { id: "link-early", name: "Early preview", template: "Feature highlight", token: null, days: 58 },
];

// Which template an event is about, weighted so one leads with about a
// third of exports (the digest's share finding), and "Event promo" is used
// least. "Company milestone" gets nothing: an unused template.
const TEMPLATE_WEIGHTS = [
  [byName["Product launch"], 34],
  [byName["Feature highlight"], 22],
  [byName["Stat highlight"], 18],
  [byName["Partnership announcement"], 14],
  [byName["Event promo"], 12],
];

/** A time on day `daysAgo` (0 = the pinned day), in Chicago (UTC-5 in
 * CDT), mornings weighted heavier, Tuesday mornings most. */
function timeOn(daysAgo) {
  const dayStart = NOW - daysAgo * DAY - 17 * 3_600_000; // local midnight, as UTC
  const weekday = new Date(dayStart + 12 * 3_600_000).getUTCDay(); // 0 Sun .. 6 Sat
  const morning = weekday === 2 ? 0.75 : 0.5;
  const localHour = rand() < morning ? 8 + Math.floor(rand() * 4) : 12 + Math.floor(rand() * 7);
  const minute = Math.floor(rand() * 60);
  return new Date(dayStart + (localHour + 5) * 3_600_000 + minute * 60_000).toISOString();
}

let n = 0;
const events = [];
const push = (daysAgo, action, extra = {}) => {
  // Never after the pinned clock (the pinned day's afternoon is the future).
  let createdAt = timeOn(daysAgo);
  if (Date.parse(createdAt) > NOW) createdAt = new Date(NOW - (n % 120) * 60_000).toISOString();
  events.push({
    id: `evt-${String(++n).padStart(5, "0")}`,
    companyId,
    templateId: extra.templateId ?? weighted(TEMPLATE_WEIGHTS),
    action,
    userId: extra.userId ?? null,
    variantId: null,
    actor: extra.actor ?? "member",
    linkId: extra.linkId ?? null,
    createdAt,
  });
};

for (let daysAgo = 59; daysAgo >= 0; daysAgo--) {
  const current = daysAgo < 30;
  const weekday = new Date(NOW - daysAgo * DAY).getUTCDay();
  const weekend = weekday === 0 || weekday === 6;
  const scale = weekend ? 0.35 : weekday === 2 ? 1.3 : 1;
  // Exports grow window over window; opens fall (public opens included).
  const exports = Math.round((current ? 7 : 6) * scale * (0.75 + rand() * 0.5));
  const opens = Math.round((current ? 8 : 17) * scale * (0.75 + rand() * 0.5));
  for (let i = 0; i < exports; i++) push(daysAgo, "download", { userId: pick(ACTIVE) });
  for (let i = 0; i < opens; i++) push(daysAgo, "open", { userId: pick(ACTIVE) });
  // Posting started in the current window: the chip reads New.
  if (current) {
    const shares = Math.round(exports * 0.3);
    for (let i = 0; i < shares; i++) push(daysAgo, "share", { userId: pick(ACTIVE) });
  }
  // A bulk run now and then (never an export).
  if (daysAgo % 9 === 3) {
    for (let i = 0; i < 6; i++) push(daysAgo, "bulk_export", { userId: ACTIVE[0] });
  }
  // Public link traffic, while each link exists.
  for (const link of LINKS) {
    if (daysAgo >= link.days || rand() < 0.35) continue;
    const templateId = byName[link.template];
    const opensHere = 1 + Math.floor(rand() * 3);
    for (let i = 0; i < opensHere; i++) {
      push(daysAgo, "open", { templateId, actor: "public", linkId: link.id });
    }
    if (rand() < 0.6) push(daysAgo, "download", { templateId, actor: "public", linkId: link.id });
  }
}

events.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));

db.usageEvents = events;
db.templateLinks = LINKS.map((l) => ({
  id: l.id,
  name: l.name,
  templateId: byName[l.template],
  revokedAt: null,
  createdAt: new Date(NOW - l.days * DAY).toISOString(),
  token: l.token,
}));
db.members = MEMBERS.map((m) => ({ ...m, companyId }));
fixture.pinnedClock = PINNED_CLOCK;

await writeFile(file, JSON.stringify(fixture, null, 2) + "\n");
console.log(
  `seeded ${events.length} events, ${db.templateLinks.length} links, ${db.members.length} members; clock ${PINNED_CLOCK}`,
);
