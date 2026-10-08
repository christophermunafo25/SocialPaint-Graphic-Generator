# New look, Phase 8: Insights

You are a senior engineer on SocialPaint (this repository). This phase rebuilds Insights & Analytics (`/insights`) to the Figma file "Master UX-UI": the header with Export CSV, four filters (date range, templates, members, platforms), the month-in-brief digest, four headline cards, the trend chart beside Top templates, and Public links.

It also lands the product work PLAN.md schedules here: **filters by template, member and platform, with the range summary**. Two data faults found while drafting come with it, since the filters depend on them (§9 D2, D3). A third finding, that Settings › Sharing lost Copy on a wrong premise, was fixed in its own PR before this phase (§9 D1).

**Before building:** CJ updates the Insights frames for the neutral change chip (§9 D7). Read the frames again first and note anything else that moved.

Be exact. Work through the steps in §5 in order, run the checks each step names, and commit after each step with `npm run verify` green (`npm run verify && git commit`). Check `git branch --show-current` before every commit. If something here turns out to be wrong once you are in the code, stop and explain the conflict instead of improvising.

**A note on familiar interactions.** CJ keeps interactions people already use when a frame leaves them out. §9 D10 records what stays; if you find another one, stop and ask.

Insights is **admins only**, as today; members never reach it.

---

## 1. Read these first

1. `PLAN.md` (decision 6, and "Behavior changes that need data or product work"), `RULES.md`, `BRIDGE.md`, and `PHASE-7.md` §8 and §9 (12 / 1.4 text, the toast, confirms; and D4, which §9 D1 here corrects).
2. `PHASE-8-SCREENS.md` in full: Part A (what is drawn) and Part B (what it stands on).
3. The references `reference/insights.png` and `insights-dark.png`.
4. The code: `admin/Dashboard.tsx`, `admin/insights/*` (InsightKpi, TrendCard, TopTemplatesCard, PublicLinksCard, SizeCard, WeekdayCard, exportCsv), `src/lib/insights/buildInsights.ts` and its test, the usage stores (`src/lib/stores/supabase/usageStore.ts`, the local store), `SchemaRenderer.tsx`, `TemplateUsePage.tsx`, `src/lib/templates/platforms.ts` (`classifySize`), and migrations 0026, 0027 and 0033.
5. The primitives, especially `Filter`, `Select`, `Tabs`, `Button`, `Status`, `Tooltip` and `Card`.

## 2. What changes

| Part | Today | After this phase | Figma |
|---|---|---|---|
| Header | Title; the range as a segmented control | Title with Export CSV (neutralOnPage); a row of four filter menus: "Last 30 days", "All templates", "All members", "All platforms" | 13:906, 13:911 |
| Digest | None (findings are computed but never shown) | A heading from the range ("Your month in brief" on 30 days), the window's dates, and one sentence from the numbers (D5) | 13:925 |
| Headline cards | Four KPIs with sparklines, count-up and an "Up 18% ↗" line | Exports, Opens, Posted to LinkedIn, Active members: the number, a neutral change chip whose arrow carries the direction, and "vs previous {range}" (D7, D8) | 13:940 |
| Trend | An area chart with the previous window dashed | Bars per day (month on 12 months), the Exports / Opens / Posted tabs, the range note, a highlighted bar with its tooltip (D9) | 13:975 |
| Top templates | Five rows, "See all" | Five rows with bar tracks, "View all" | 13:1036 |
| Public links | Name, Views, Exports, Copy | Name over the template, an exports bar, Opens, Exports, Copy, "View all" to Settings › Sharing, five rows (D1, D11) | 13:1076 |
| Weekday and Size cards | Shown | Gone (D10) | none |

## 3. Invariants

- **Every route and role stays as it is**; the range stays in the URL, and the new filters join it.
- **Multi-tenant (PLAN decision 6).** Every number, name and link is the workspace's own; the frame's Frontier Summit, 1,128 and Tuesday mornings are samples.
- **Counts don't change meaning.** Exports stay `download` events (bulk exports excluded), Opens stay `open`, Posted stays `share`. Filtering narrows the events; it never redefines them.
- **The workspace timezone** decides days, weeks and "mornings", as today.
- **Tokens and primitives only** in what this phase rebuilds, with the chart colours ruled in §9 D6.
- **Behaviour that stays,** drawn or not: loading skeletons, the error state with Retry, the whole-page empty state (D12), the tabs' arrow keys and live region, Export CSV's file, rows linking to their templates, and Copy's disabled state for links made before 0033.

## 4. Before you change anything

1. Seed the fixture first (§9 D13): about 60 days of events relative to a pinned clock, several members, five templates and four links, with every chip state present (up, down, flat, new). The screenshot run pins the clock so the rolling windows hold still.
2. Baseline: `npm run shots -- capture .shots/before` and `npm run shots -- props .shots/props-before.json`, after the seed.

## 5. Steps

### Step 1: the data
- **Member attribution** (D2): migration `0044`, a `before insert` trigger on `usage_events` that fills `user_id` from `auth.uid()` only on `actor = 'member'` rows where it is null (public-link events stay unattributed, as 0026 intends). Any member event logged from an Edge Function passes the user explicitly. A check in `supabase/verify`: a member insert without a user comes back attributed; a public insert stays null. The local store records the dev user. History stays unattributed.
- **Billing's check joins the suite:** `scripts/billing/check-0043.sql` (Phase 7b) was written as a stand-alone script because the 7b PR missed `supabase/verify/run.sh`. Move its checks into `supabase/verify` beside 0044's, so `run.sh` covers both.
- **Every `usage_events` read in `usageStore.ts` is paged** (D3), `getUsageSummary` and the two-year read for 12 months included, with a stable order (`created_at`, then `id`); counting stays where it lives. A unit test fakes the 1,000-row cap.
- **`buildInsights`** takes `templateId`, `userId` and `platform` filters, returns the window's dates, and gains the part-of-day helper the digest needs. Platform follows the template's canvas size (`classifySize`), as the Brand Templates chips do.
- Commit: "New look phase 8: the data".

### Step 2: the shared pieces
- The change chip, neutral in every state (`--surface-sunken`, `--text-primary`, the arrow carrying the direction; D7), the bar-list row (8 tall, radius 4), the "View all" link, and the chart colours (D6).
- The filter row on `Filter` menus, the four filters in the URL.
- Commit: "New look phase 8: the shared pieces".

### Step 3: header, filters and digest
- Export CSV in the header; the CSV follows the filters, which go in its filename (D11).
- The digest card: the icon tile, the heading from `RANGE_LABEL` (D5), the window's dates, and the sentence from the numbers `buildInsights` returns (numbers only, no adjectives, as the findings).
- Commit: "New look phase 8: header and digest".

### Step 4: headline cards and trend
- Four cards: label, number, chip and "vs previous {range}" from `RANGE_LABEL` (D8).
- The trend as bars with the tabs, the range note ("Daily, Aug 17 to Sep 15"; "Monthly" on 12 months), the axis from the data, the busiest bar highlighted at rest with its tooltip; hover and keyboard move it (D9).
- Commit: "New look phase 8: headline cards and trend".

### Step 5: Top templates and Public links
- Top templates with bar tracks, the leader at full width (D6).
- Public links: five rows by exports, name over the template, the exports bar, Opens, Exports, Copy; "View all" to Settings › Sharing (D1, D11).
- Commit: "New look phase 8: top templates and public links".

### Step 6: legacy and docs
- Delete the Weekday and Size cards, the sparklines, count-up and the previous-window line, the unused findings (D10), and `Kpi` if Insights was its last reader.
- BRIDGE §3 and ARCHITECTURE (Insights on the new look, the filters, attribution).
- Commit: "New look phase 8: legacy names and docs".

### Step 7: the gate
1. `npm run verify` and `npm run build`.
2. Click through as admin on the seeded fixture: every filter alone and together, the range, the tabs, hover and keyboard on the chart, Copy, Export CSV with filters, View all; and that a member still can't reach Insights.
3. `capture .shots/after`, `compare`: expected `insights-*` (and `/dev/ui` for a new primitive); everything else 0%. Side by side with both references.
4. Keyboard in both themes: the filter menus, the tabs, the chart, Copy and the links.
5. The PR: "New look, Phase 8: Insights", with the migration and its deploy step, the compare table, every decision as built, proposed copy and surprises.

## 6. Out of scope

- An AI-written digest (D5): its own feature, if wanted.
- Confirmed LinkedIn posts: LinkedIn gives no callback, so Posted counts presses of Post to LinkedIn.
- Billing (Phase 7b, on hold).

## 7. Expected changes

- **Changes:** the Insights page, as §2 describes.
- **Data:** migration 0044 (the attribution trigger), and a check for it in `supabase/verify`. No backfill.
- **Unchanged:** every other screen.
- **New copy from the frame:** "Export CSV", "Last 30 days", "All templates", "All members", "All platforms", "Your month in brief", "Posted to LinkedIn", "Active members", "Exports", "Opens", "Posted", "Top templates", "View all", "Public links", "Link", "Copy".
- **Proposed** (not in the frame; list in the PR): the range labels ("Last 7 days" … "Last 12 months"), the per-range digest headings, the digest's sentence rules, "vs previous {range}", "Monthly, …", "Public links" in the member filter (D4), the chip's "New" and "No change", "No exports match these filters.".
- **Copy that goes:** the empty state's paragraph (D12), "See all", "Views", the KPI change sentences, the Weekday card's line.

## 8. Rulings on what the file leaves open

| Item | Ruling |
|---|---|
| Slot widths | The Digest and the Trend row run the full 1015 with 28 gaps; the 1009 / 168 values are file slips. |
| 12 / 1.4 text | `.t-label-xs`, as Phases 6 and 7 ruled. |
| Digest sentence (22 / 30) and axis labels (11 upper case) | The nearest existing classes until Figma adds styles (RULES §1); named in the PR. |
| Dark lit edge on cards | RULES §4: Elevation/Small only. |
| Cards | `Card`, with the drawn header gaps (24 Top templates, 16 Public links) as modifiers, as Phase 7 did for `SettingsCard`. |
| Tooltip in Dark | The primitive as it is (raised, Elevation/Medium); the frame's sunken, shadowless Dark tooltip is not adopted. |
| Footer links | None, as drawn. |

## 9. Decisions (CJ, 2026-10-08)

CJ ruled on D1, D2, D3, D5, D7, D8, D10 and D13; D4, D6, D9, D11 and D12 are built as the draft recommended (marked "as recommended").

1. **D1. Copy on public links, here and on Sharing.** PHASE-7 §9 D4's premise was wrong: migration 0033 (CJ, 2026-09-15) stores each link's token, so every link made since then can be copied; only older links can't.
   - **Sharing is fixed first, in its own PR:** rows keep Copy, Revoke and the ⋯ menu (Manage, New address) as drawn. Copy is disabled on links made before 0033, as the Insights card already does, and New address is how someone gets a copyable link for one of those.
   - That PR also corrects every comment that still says an address is shown once (`TemplateLinksDialog.tsx`, `publicLinkStore.ts`, `template-links`, `publicLink.ts`, `ARCHITECTURE.md`), so the next reader doesn't repeat the claim, and PHASE-7 §9 D4.
   - Insights keeps Copy as drawn, disabled on pre-0033 links.
2. **D2. Member attribution: the trigger.** `usageStore.record` inserts from the browser with the member's session, and the insert policy already limits `user_id` to null or `auth.uid()`.
   - Migration 0044: a `before insert` trigger fills `user_id` from `auth.uid()` only on `actor = 'member'` rows where it is null, so public-link events stay unattributed as 0026 intends.
   - Wherever a member event is logged from an Edge Function, pass the user explicitly: `auth.uid()` is empty under the service key.
   - Add a check to `supabase/verify` that a member insert without a user comes back attributed and a public insert stays null, since the local backend never runs the trigger.
   - History stays unattributed.
3. **D3. Page every `usage_events` read in `usageStore.ts`, now.** `getUsageSummary` reads a workspace's whole history with no date bound, and the 12-month range fetches two years, so both reach 1,000 rows long before the 30-day view does. Page with a stable order (`created_at`, then `id`; `getInsightEvents` sets none today), and leave the counting where it lives. A unit test fakes the 1,000-row cap, since the screenshot fixture runs on the local backend and never hits it.
4. **D4. Public activity in the member filter** (as recommended): "Public links" as the last entry, so "All members" visibly includes outside fills.
5. **D5. The digest:** a sentence built from the numbers `buildInsights` already returns, under the rule the findings follow (numbers only, no adjectives). Its heading and sentence take their window from `RANGE_LABEL`, since "month" fits only one of the four ranges.
6. **D6. Chart colours** (as recommended): series on the accent tokens (Exports green, Opens blue, Posted violet `--accent-purple`), bars at rest on `--surface-sunken`, the grid on `--border-default`, bar-list fills on `--text-strong`, the leader bar full width in both lists.
7. **D7. The change chip is neutral in every state:** `--surface-sunken` with `--text-primary`, the arrow carrying the direction. Brand colours carry no meaning in this system, and colouring by direction would make Slime read as good and Fire as bad. Neutral also covers flat and new with no extra rule. CJ updates the Insights frames to match before this is built.
8. **D8. "vs previous {range}"**, from `RANGE_LABEL` ("vs previous 7 days", "vs previous 12 months"), matching the chart legend's "Previous 30 days". "Posted to LinkedIn" stays as drawn.
9. **D9. The chart at rest** (as recommended): the busiest bar highlighted with its tooltip; hover and the keyboard move it; leaving puts it back. The axis comes from the data.
10. **D10. As drawn:** the Weekday and Size cards and the sparklines go (with count-up, the previous-window line and the never-shown findings, keeping the template-share one for the digest).
11. **D11. Export CSV and View all** (as recommended): the CSV keeps today's columns, with rows and filename following the filters. Top templates' View all goes to the Template Builder; Public links' to Settings › Sharing, the card capped at five rows by exports.
12. **D12. Empty states** (as recommended): the whole-page "No usage yet" card keeps its title and Open Brand Templates, without the paragraph. Filters that match nothing show the cards at zero and the digest reads "No exports match these filters."; Public links stays hidden with no links.
13. **D13. Fixture data:** pin the clock for the screenshot run and seed relative to it, so the rolling windows hold still between runs, with enough members for the member filter to switch between and every chip state present (up, down, flat, new). Acme Studios content only (PLAN decision 6).
