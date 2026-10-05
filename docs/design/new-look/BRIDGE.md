# New look: the legacy bridge

`src/styles/socialpaint.css` names its tokens its own way (`--bg-canvas`, `--fill-action`, `--gen-sunken`). The Figma file names them by role (`--surface-page`, `--surface-inverse`, `--surface-sunken`). Pages move to the Figma names one phase at a time, so until Phase 9 the old names keep working in three ways:

1. **Owned by Figma.** Where the Figma code name equals the old name, `tokens.css` defines it and the old declaration is deleted (Phase 1). The value can change.
2. **Bridged.** Where an old name plays exactly one Figma role everywhere it is read, `src/styles/legacy-bridge.css` points it at that token.
3. **Left alone.** Where an old name plays several roles, it keeps its old value until the phases that rebuild those components stop reading it.

`npm run tokens:check` fails if a stylesheet declares a name from group 1 or 2 at theme level, so each of those has one definition. New code reads Figma names only.

## 1. Names tokens.css owns

| Names | Change |
|---|---|
| `--slime`, `--lapis`, `--christina`, `--fire`, `--deep-moss`, `--ink-900`, `--ink-800`, `--ink-700`, `--paper-050`, `--paper-100` | None |
| `--space-3xs` to `--space-3xl` (9) | None |
| `--radius-control` | 5 → 7 |
| `--radius-menu-item` | 10 → 7 |
| `--radius-control-md`, `--radius-card`, `--radius-menu`, `--radius-media-plate`, `--radius-pill` | None (9, 20, 16, 15, 999) |
| `--focus-width` | 2 → 1 |
| `--focus-offset` | None (2) |
| `--text-primary`, `--text-secondary`, `--text-muted`, `--border-strong` | None |
| `--ring` | Dark: Slime → white |
| `--input-bg` | Light `#FFFFFF` → `#F1F1EF`; Dark `#171819` → white 8% |
| `--chip-tile` | Light `#F9F9F8` → `#FFFFFF`; Dark `#252627` → `#0B0B0C` |
| `--btn-primary-bg`, `--btn-primary-fg` | Ink and paper → Deep Moss and Slime in Light, Slime and Deep Moss in Dark |
| `--switch-background` (was in `theme.css`) | Light ink 16% → `#0B0B0C` 16%; Dark white 20% → 30% |

The `.sp-gate[data-theme="dark"] .sp-gate__panel` override of `--input-bg` stays: it is a component scope, and the gate is out of scope.

## 2. Bridged names

| Old name | Reads | Change |
|---|---|---|
| `--bg-canvas` | `--surface-page` | None |
| `--bg-surface`, `--bg-card` | `--surface-raised` | None |
| `--text-heading` | `--text-strong` | Dark `#F9F9F8` → `#F1F1F1` |
| `--border` | `--border-default` | None |
| `--gen-sunken` | `--surface-sunken` | None |
| `--gen-inverse` | `--surface-inverse` | None |
| `--gen-on-inverse` | `--text-inverse` | None |
| `--fill-action` | `--surface-inverse` | Light `#272727` → `#0B0B0C`; Dark `#F1F1F1` → `#FFFFFF` |
| `--text-on-action` | `--text-inverse` | Light `#F1F1F1` → `#FFFFFF`; Dark `#272727` → `#0B0B0C` |
| `--tag-bg-on-media` | `--tag-overlay-bg` | None |
| `--state-danger`, `--state-danger-on-surface` | `--state-error` | `#C94040` → `#D43535`; Dark `#E57373` → `#EC5656` |
| `--btn-primary-bg-hover` | `--btn-primary-bg` under `--state-hover-inverse` | Follows the new primary pair (the old mix toward `--fill-action` would flash ink) |
| `--shadow-card`, `--shadow-rail` | Elevation/Small's drop: `2px 2px 8px 0 var(--shadow-raised)` | 6/6 blur 25 → 2/2 blur 8. The old Dark bevel (`--card-highlight`) already matches Figma's |

Names defined from these follow them: `--primary`, `--primary-foreground`, `--accent-foreground`, `--destructive`, `--sidebar-ring` and `--radius` in `theme.css`, and `--danger-wash`, `--chip-tile-active-fg`, `--focus-ring` and `--focus-ring-tight` in `socialpaint.css`.

## 3. Left alone until their components move

| Old name | Read by | Figma roles | Phase |
|---|---|---|---|
| `--nav-active-bg` | Selected segments (`.sp-seg`, `.sp-segmented__option`), tab strip tabs, choice tiles, selected chips, the size gallery rail (`.sp-railitem`). The sidebar and the Settings rail moved to primitives in Phase 3 | `--control-fill` (rail), `--control-thumb` (segments and tabs), `--chip-selected-bg` or `--surface-inverse` (chips) | 6, 7 and 8; the Template Builder's controls in 9 |
| `--nav-active-fg` | Wherever `--nav-active-bg` is (the sidebar row moved to NavItem in Phase 3) | `--text-strong` | 6, 7 and 8; the Template Builder's controls in 9 |
| `--media-overlay` | `.sp-edit-overlay` (Brand Studio's preview hover) and `.sp-chat-editor-sheet__scrim` (the chats' editor as a sheet below 1180) | `--overlay-hover` and `--overlay-scrim` | 6 (Brand Templates' previews moved to PreviewOverlay in 4, Generate's in 5); the sheet's scrim when the chats' layout moves |
| `--edit-chip-bg` | `.sp-edit-overlay__chip` (Brand Studio), whose icon reads `--text-primary` | `--overlay-control` under `--overlay-control-fg` (bridging only the fill would put a white icon on a white chip in Dark) | 6 |
| `--shadow-rest` | The legacy platform chips and filter bar search field (the Template Builder and the size gallery; Brand Templates moved off them in Phase 4, Generate History in 5), and the tooltip | The elevation each Figma component uses | 8 and 9 |
| `--radius-control-lg` (12) | Large buttons and inputs (`.sp-btn-lg`, `.sp-input-lg`), the import popover, the build picker card, gate controls (both chats moved to the primitives in Phases 4 and 5) | 9 for controls, 16 for popovers, 20 for cards | 6 to 8; the build picker and import popover in 9; the gate keeps 12 |

Page-scoped groups (`--gen-*` for the chats, down to the scroll fade and the template chat's Missing marker since Phase 5, `--chip-*`, `--sb-*` for the narrow layout's top bar and drawer (the desktop sidebar left it in Phase 3), `--start-*` for the build picker, `--gate-*`, `--viz-*`, `--edge-*`, `--card-*`) stay as they are until their page moves. Phase 9 deletes whatever is left, along with this file and `legacy-bridge.css`.
