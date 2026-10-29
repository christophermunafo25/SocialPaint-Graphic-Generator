# New look, Phase 9: values with no Figma token (§4.4)

Counted on `feat/new-look-phase-9` on 2026-10-29, after Steps 1 to 4. Step 5 points every legacy name at a Figma token (D4). These are the live values that have no exact twin in `tokens.css` in both themes, and so no token to read without either a change in Figma or a visible change on screen.

Readers count every `var()` read, the builder's included, because the builder's fenced block reads Figma tokens only (D10).

## Colours

| Family | Names | Light | Dark | Readers | Nearest Figma token | Proposal |
|---|---|---|---|---|---|---|
| Hover and raised greys | `--bg-hover`, `--nav-active-bg`, `--nav-hover-bg`, `--icon-btn-bg-hover` | #E2E2E2 | #2A2A2A | 43 | `--surface-sunken` (#ECECEC / #2F3133) | Map |
| | `--bg-raised`, `--editor-pasteboard`, `--start-input-bg` | #E8E8E8 | #171819 | 14 | `--surface-sunken` / `--surface-page` | Map |
| | `--chip-raised` | | #252627 | 3 | `--surface-sunken` | Map |
| Disabled text | `--text-disabled` | ink-750 at 25% | paper-075 at 25% | 19 | none: `--text-muted` is 70% | **Add** text/disabled |
| Primary state | `--state-primary` | #272727 (ink-750) | #17FF7E (slime) | 45 | `--text-primary` in Light, `--accent-green` in Dark | **Add** accent/primary-on-surface, or map to `--text-strong` |
| Warning | `--state-warning`, `--fill-warning` | #756200, #FFD900 | #FFD900 | 3 | none | **Add** state/warning |
| Washes | `--accent-wash`, `--accent-wash-strong`, `--danger-wash`, `--accent-border` | slime at 14% and 24%, error at 16%, ink-750 at 40% | the same over the dark values | 14 | `--accent-green-subtle` (slime at 10%) | Keep as `color-mix()` of Figma tokens, no literal |
| Brand-moment hover | `--purple-kara` | #9F60FF | #9F60FF | 2 | `--accent-purple` (#A782FF) | Map |
| Build picker tiles | `--start-tile-*`, `--start-glyph-*` (8) | Fire, #220905, #A66BFF, #1B0B35, Slime, #082A16, #00EBFF, #071B25 | swapped | 8 | Fire/Choco, Violet/Kara, Slime/Deep Moss, Lapis/Ocean Tide | Map to the primitive pairs (the tiles shift slightly) |
| Scrims | `--gen-marker-bg`, `--media-overlay` | ink-900 at 56% | the same | 2 | `--overlay-scrim` (50%) | Map |
| | `--gen-marker-edge` | white at 60% | the same | 2 | `--overlay-edge` (paper-075 at 20%) | **Add**, or map |
| Logo plates | `--plate-light`, `--plate-dark` | #F9F9F8 | #0B0B0C | 2 | paper-050, ink-900 (primitives only) | **Add** plate/light and plate/dark (PHASE-9 §8) |

## Shadows, radii and contrast

- **Shadows:** `--shadow-card`, `--shadow-card-hover`, `--shadow-rest` and `--shadow-rest-hover` become `--elevation-small` (at rest) and `--elevation-medium` (hover), as D5 says. No request.
- **Radius 12:** `--radius-control-lg` maps to 9 for controls, 16 for popovers and 20 for cards (BRIDGE §3). No request.
- **Contrast (D9):** `--state-error` on the sunken, input and control fills measures 3.75:1 in Dark and 4.08 to 4.26:1 in Light, under 4.5. The fix is a darker Light error or a lighter Dark one in Figma.
