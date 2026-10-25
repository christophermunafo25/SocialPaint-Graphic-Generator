---
name: fidelity
description: Run the render fidelity harness, add a fixture, or read its results. Use when checking how graphics render and export against Figma goldens or blessed baselines in Chromium, Firefox and WebKit.
---

# Fidelity harness

Commands, from the repo root:

- `node scripts/fidelity/fidelity.mjs run [--only a,b] [--engines chromium,firefox,webkit]`
- `node scripts/fidelity/fidelity.mjs bless <name>`: for starter fixtures, today's Chromium render becomes the golden.
- `node scripts/fidelity/fidelity.mjs baseline <name>`: records the current changed percentages as the fixture's baseline. Only with CJ's approval.
- `node scripts/fidelity/goldens.mjs fetch <name>`: for figma fixtures, exports the golden and the node JSON. Needs `FIGMA_TOKEN`.

## Reading results

Changed % is the share of pixels that differ by more than 6 on any channel. Browser and Figma text antialiasing differ, so every fixture has its own baseline per engine, and the runner fails only when a fixture gets worse than its baseline by more than its tolerance. Open `test/fidelity/out/<engine>/<name>.heatmap.png` to see where the changed pixels sit.

## Adding a figma fixture

1. Create `test/fidelity/fixtures/<name>/fixture.json` with `kind: "figma"` and `source: { fileKey, nodeId }`.
2. Read exact values from Figma (the Figma MCP server, or the node JSON the fetch script saves) and build `schema` with the `TemplateField` properties that exist today. List anything you couldn't express in `unsupported`, with the reason.
3. Put images and fonts beside the fixture. Commit a font only when its license allows it; otherwise use `test/fidelity/fonts-private/`.
4. Fetch the golden, run all three engines, report the numbers, and ask CJ before recording a baseline.

## Adding a starter fixture

Name it `starter-<blueprintKey>`; the dev render route materializes it, and `?variant=dark` selects the Dark variant. Bless it, run all engines, and ask CJ before recording a baseline.
