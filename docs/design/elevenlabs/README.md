# ElevenLabs: the program

The Figma file "Master UX-UI New Brand Eleven Labs Inspired" (`dQ8bQq3V7Bue5pvFrI2g9X`) is the SocialPaint design system in its ElevenLabs-inspired form, with every screen redrawn in Light and Dark. It replaces "Master UX UI New Brand (Copy)" (`1dYWgFH2V8i9Jez2ylI3ky`) as the source of truth for tokens, components and screens. This folder carries it into the code in phases, one pull request each, the same way `docs/design/new-brand/` did.

The structure the new-brand program built stays. The ElevenLabs system changes the palette to a neutral gray ramp, makes raised surfaces flat with hairline edges, gives fields a visible edge, runs the sidebar flush, tightens the radius scale and moves the chat composer onto one line. Most of that arrives through the tokens. The rest is a short list of component and screen changes in `PROMPT.md` sections 5 and 6.

## Read in this order

1. `IMPLEMENT.md` is the prompt that runs the program from Phase E1 to Phase E9. It says how a phase runs, how to read the Figma file and what to read around in it, and gives each phase from E3 on its brief. Start there.
2. `PLAN.md` holds the decisions, the phases and the screen map with node ids.
3. `PROMPT.md` is the brief. It holds the token tables, the component tables with their ElevenLabs changes, the patterns and the page map of the Figma file.
4. `RULES.md` holds the rules every phase follows. It is `docs/design/new-brand/RULES.md` with the ElevenLabs changes applied, and it stands alone.
5. `BRIDGE.md` lists every token that was added, changed, moved or removed, and every component that was renamed, added or retired.
6. `PHASE-E1.md` and `PHASE-E2.md` are the prompts for the first two phases. From Phase E3 on a phase is built straight from `PLAN.md` and its frames, with `IMPLEMENT.md` section 5 as its brief, as CJ asked for the new-brand program from its Phase 4.
7. `reference/` holds working builds. `liquid-selection.html` is the liquid selection (`PROMPT.md` section 7.1) on the real tokens, with a slow motion switch, and `gooey-nav-01/` is the BYQ Supply gem CJ supplied, which it is adapted from. `microinteractions.html` runs the six microinteractions (sections 7.2 to 7.7) on the real tokens and primitives, with Slow motion and Reduced motion switches.

## What is already done

The token half of Phase E1 is prepared and checked. `phase-e1-tokens.patch`, in this folder, applies cleanly to `main` at `c54794a`, and still did at `223970f` (#203, a docs-only change), and carries the new `master.tokens.json` (85 Color tokens with `logo/ink`), the regenerated `tokens.css`, the exporter pointed at the new file, the generator's `layout` unit rule and the stylesheet lines that hand names to `tokens.css`. `npm run tokens:check` and `prettier --check .` pass on it, and so do the style tests.

The Figma file was checked against its screens while this kit was written, and the fixes are listed in `BRIDGE.md` section 6, so a phase reads the fixed components.

## Where things are in Figma

| Page | Id | What it holds |
|---|---|---|
| Cover | `2201:2` | What the system is and how Claude Code reads it |
| Foundations | `4012:1192` | Color, Typography, Spacing and size, Radius, Borders and elevation, Icons, Motion, Layout, Interactions (`6262:353`) |
| Components | `4012:1193` | The index of the 39 core components |
| Components · Actions | `6218:2` | Button, Icon Button, Send Button |
| Components · Inputs | `6220:2` | Input, Text Area, Select, Search, Search Field, Field, Upload, Stepper |
| Components · Selection | `6221:2` | Switch, Checkbox, Radio, Segment, Segmented Control |
| Components · Labels and feedback | `6222:2` | Badge, Tag, Chip, Avatar, Tooltip, Toast, Alert, Progress Bar, Progress Steps, Skeleton, Empty State |
| Components · Navigation | `6221:524` | Nav Item, Breadcrumb, Menu Item, Menu, Tab, Tabs, Page Header, Footer Links |
| Components · Containers | `6222:834` | Card, Dialog, Metric, Table Row |
| Product components | `4012:1194` | Shell, Brand, Templates, Generate, Brand Studio, Template Builder, Settings and Onboarding columns |
| Patterns | `4012:1195` | App shell, Filter bar, Composer and recent posts, Result thread, Variations bar, Inspector, Details panel, Settings page |
| Docs | `4012:1196` | What changed from v2 and the handoff |

Every component board shows the React component, its file and CSS class, how the Figma properties map to props, the tokens it reads, accessibility notes, and every variant in Light and Dark above the main component.
