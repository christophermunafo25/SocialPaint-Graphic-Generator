# New look: the plan

The Figma file "Master UX-UI" (`mEJRslarcQDkgPeY6AObi5`) is the new look for the platform: one design system, a library of components with their interaction states, and the confirmed screens for every area. This folder carries it into the code in phases, one pull request each, merged to `main` as each passes its gate.

- `README.md` says how to run a phase and how to update tokens later.
- `PLAN.md` (this file) is the program: decisions, scope, phases and the screen map.
- `RULES.md` holds the rules every phase follows.
- `BRIDGE.md` maps the old token names to the Figma tokens while pages move.
- `PHASE-1.md` is the Claude Code prompt for Phase 1. Each later phase gets its own prompt when it starts.

## Decisions (CJ, 2026-10-02)

These are settled. Phase prompts build them and do not re-ask.

1. **Figma is the source of truth for tokens**, with Figma's names. `src/styles/tokens.css` is generated from `design/tokens/master.tokens.json`, an export of the file, and nobody edits either by hand.
2. **Phases go straight to `main`.** There are no customers yet, so there is no integration branch. Each phase is a pull request reviewed on its Vercel preview.
3. **Behavior changes exactly as the Figma file shows**, including the changes that need data or product work. Where the code and the file disagree, the file wins unless a phase prompt records an exception.
4. **Error red** is `#D43535` in Light under a white label and `#EC5656` in Dark under an ink label.
5. **Focus** is the code's keyboard ring, now drawn in the Figma file: 1 px, ink `#272727` in Light and white in Dark, 2 px outside the element. Chips, tags, segments, tabs, rail items and look tiles draw it against their edge.
6. **The app stays multi-tenant and customizable.** The Figma file designs the interface. Everything shown inside Brand Studio, Brand Templates and Insights & Analytics is placeholder content, and the screens never decide what an account contains. No SocialPaint brand values, templates, copy or imagery are seeded into new accounts. The one exception is the Brand Studio cover images, which are shared platform art and look the same in every account.
7. **A template opens to the fill page.** A Brand Templates card opens the fill page, where the member fills the template in by hand. "Use AI to assist" on that page opens the template chat, and the chat's "Fill in by hand" leads back. The fill page uses the Edit details layout: the graphic on the left and every field in one Details panel on the right, with Download PNG as the only Deep Moss button. Use AI to assist, Bulk fill and Public link are neutral header buttons. After a download, the panel offers Post to LinkedIn as its Deep Moss button and Download PNG becomes a neutral Download again. LinkedIn is the one place to post for now: it opens a new LinkedIn post with the caption, and the person attaches the graphic they downloaded, as the code does today. The public link page keeps sharing the fill page's form, so it gets the new form too, without the sidebar and the header buttons. (The code already opens the fill page, since PR #151.) **Amended (CJ, 2026-10-04, after Phase 4):** the fill page and the public link page keep the earlier step form on the new look (a step rail, one field per step with Back and Next, then a finish step with the look, the caption, Download PNG and Post to LinkedIn) beside a live Preview card, in place of the single Details panel. The template chat's Edit details keeps the Details panel. In the library, shelves fit three cards across at laptop widths (four from 1800), the platform chips keep their earlier 48 by 152 size, and a card steps through its looks on hover and focus instead of the preview dim.

## What follows from them

- Primary buttons become Deep Moss with a Slime label in Light and Slime with a Deep Moss label in Dark. The Connected and Active status pills draw from Deep Moss and Slime too. The stylesheet's old governing rule (no brand color in chrome except brand moments, charts and artwork) gives way to the Figma file, and `RULES.md` lists where brand colors now appear.
- Destructive buttons become filled red. The code draws them outlined today on purpose; the Figma file wins.
- A focused text field shows the caret and nothing else. Today it also recolors its border.
- Page headers become a title alone. The eyebrow and the helper line go.
- Controls move from 5 px to 7 px corners, fields and large buttons to 9 px, menu rows from 10 px to 7 px.
- Cards and the sidebar take Elevation/Small (2/2 blur 8) in place of 6/6 blur 25.
- The plan to split `socialpaint.css` into per-area files is dropped. Its sections interleave, so a split that keeps the cascade order would mislabel the files, and reordering rules risks visual changes. Each phase deletes the legacy rules its components replace, and Phase 9 deletes what is left.

## Scope

In scope: every confirmed Master frame (the screen map below), the shell around them, and the system pages they draw from.

Out of scope until they are designed: the Template Builder, onboarding and the sign-in gate, bulk fill, and layouts below desktop width (every Master frame is 1440 wide). These pick up the new token values and nothing else. Below desktop width, pages keep today's responsive behavior on the new tokens. The public link page is in between: it takes the new fill form in Phase 4 because it shares it, and the rest of that page waits for its own design.

## Phases

| # | Phase | What lands | Gate highlights |
|---|---|---|---|
| 0 | Handoff kit | This folder, the token export and its Figma plugin, the generator, the bridge, the screenshot tool | Done |
| 1 | Foundation | Generated `tokens.css` wired in, the bridge, one definition per token, the 1 px focus ring, `tokens:check` in CI | Every changed value is on the expected list; nothing else moves |
| 2 | Primitives | One React primitive per Figma component with its states built in and tested, a dev-only `/dev/ui` route that renders the Interaction states table, Generate threads in the screenshot fixture. No screen changes: each area phase moves its screens onto the primitives | `/dev/ui` matches 105:641 in both themes; every screen unchanged |
| 3 | Shell and navigation | Five nav items, Settings on the account gear, workspace switching inside Settings, title-only page headers, People inside Settings with `/people` redirecting, the canvas-size toggles removed | Every route still reachable; members see only what they saw before |
| 4 | Brand Templates | A stand-in provider for the template chat on the local backend (first step), the library, platform filters and search, the fill page with Use AI to assist (and the same form on the public link page), and the template chat, on the new primitives | Screens match their frames in both themes |
| 5 | Generate | Start, thread, result, edit and History | Same |
| 6 | Brand Studio | Overview and the six detail pages, with the new cover images committed | Same |
| 7 | Settings | All seven sections | Same |
| 8 | Insights | The dashboard and its cards | Same |
| 9 | Cleanup and QA | Delete the bridge, dead tokens and the old control classes, drop the unread `company_canvas_presets` table (a migration; Phase 3 stopped reading it), remove unused packages, add lint rules against raw colors and inline type, a full screenshot, contrast and keyboard pass, update `ARCHITECTURE.md` and the stylesheet header | Nothing legacy left |

Posting straight to people's own social accounts through connectors comes after the new look; until then LinkedIn stays the one place to post. Behavior changes that need data or product work land in their area's phase, and that phase's prompt specifies them: plan management in Settings (the code has no billing; the Plan card is a placeholder by design), Insights filters by template, member and platform with the month summary, font roles moving from Fonts to Type styles in Brand Studio, and authored questions per template field (a `TemplateField` change) in the template chat. Connectors in the attach menu (with Context: web pages and past posts) come after the new look, each as its own feature (CJ, 2026-10-04).

## Screen map

| Area | Master frames (Light / Dark) | Route | Code entry points |
|---|---|---|---|
| Generate | Start 13:1453 / 13:3598 through History 13:3359 / 13:5536 (11 each), page 8:674 | `/generate`, `/generate/c/:id`, `/generate/history` | `generate/GeneratePage.tsx`, `GenerateHistoryPage.tsx`, `generate/*` |
| Brand Templates | 13:5776 / 13:6043, Platform filter 13:6310 / 13:6689, Search 13:6511 / 13:6891, page 0:1 | `/templates?platform=&q=` | `Portal.tsx`, `templates/*` |
| Fill page | Fill page 156:674 / 157:695, after a download 159:716 / 159:904 | `/templates/:id`; the public link page `/l/:token` shares its form | `TemplateUsePage.tsx`, `TemplateFill.tsx`, `src/app/public/PublicFillPage.tsx` |
| Template chat (Use AI to assist) | Questions 13:7064 / 13:7211, Building 13:7358 / 13:7551, Result 13:7744 / 13:7946, Edit details 13:8148 / 13:8306, Public links 13:8464 / 13:8753 | `/templates/:id/chat` | `generate/TemplateChatPage.tsx`, `InterviewView.tsx`, `LookPicker.tsx`, `EditorPanel.tsx`, `admin/TemplateLinksDialog.tsx`, `lib/generate/interview.ts` |
| Brand Studio | Overview 13:9043 / 13:9176 plus 36 flow frames, page 8:676 | `/brand-studio/:category` | `admin/brand/BrandOverview.tsx`, `admin/brand/*Detail.tsx`, `admin/brand/primitives/*` |
| Insights | 13:832 / 13:1142, page 8:677 | `/insights` | `admin/Dashboard.tsx`, `admin/insights/*`, `lib/insights/buildInsights.ts` |
| Settings | Workspace 13:14570 / 13:15992, People 13:14769 / 13:16191, Integrations 13:15051 / 13:16473, Plan & usage 13:15203 / 13:16625, Sharing 13:15384 / 13:16806, Account 13:15649 / 13:17071, Advanced 13:15837 / 13:17259, page 8:678 | `/settings/:section` (`team` becomes People) | `admin/SettingsAdmin.tsx`, `admin/settings/*Section.tsx`, `admin/PeopleAdmin.tsx` |
| Shell | Every frame's sidebar | all | `Sidebar.tsx`, `GooeyNavPill.tsx`, `layout/Page.tsx` |
| System | Master UI Elements 24:674 (Interaction states 105:641), Master Design System 3:15162 | `/dev/ui` (Phase 2) | `src/styles/*`, the new primitives |

Paths under "Code entry points" are relative to `src/app/components/` unless they start with `lib/`, which is `src/lib/`.

## The code at the start (main at 93f721a)

- A Brand Templates card opens the fill page, and the fill page's "Use AI to assist" opens the template chat where Generate is configured (PR #151). The fill page still uses the step-by-step form.

- Vite 6 and React 18 SPA with its own history router (`src/app/router.tsx`), Supabase, Vercel. CI runs typecheck, the Deno check, lint, format check, tests and a build on every pull request.
- One stylesheet, `src/styles/socialpaint.css` (9,797 lines, 366 custom properties), holds the design system and every page's CSS. `theme.css` aliases the shadcn and Tailwind names onto it.
- Two control families live side by side: the July primitives (`.sp-btn`, `.sp-icon-btn`, `.sp-input`, `.sp-chip`) and the September chat set (`.sp-chat-btn`, `.sp-chat-icon-btn`, `.sp-chat-field`, `.sp-chat-select`, `.sp-chat-stepper`). Phase 2 builds the primitives that replace both families. Each area phase moves its screens onto them, and the old classes stay until nothing uses them.
- Surfaces and text already match the Figma values. Most of the visible change is in controls, buttons, corners, shadows, states and layout.
- Generate and the template chat need Supabase and the Anthropic key. On the local backend Generate shows a notice and the template chat opens the manual fill page. Phase 2 seeds Generate threads into the screenshot fixture, so a thread, its result and History render there. The template chat's states wait for Phase 4, whose first step adds a stand-in provider: it runs only on the local backend, never in a production build, and answers from the sample workspace (Acme Studios), never SocialPaint content.
