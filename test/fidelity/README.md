# Fidelity fixtures

The render fidelity harness (`docs/brand-system/PHASE-0.md`) renders each fixture through the real export path in Chromium, Firefox and WebKit and compares it with a golden. `src/app/dev/fidelity.ts` holds the type, `FidelityFixture`.

## Layout

```
test/fidelity/
  fixtures/<name>/
    fixture.json     the fixture
    golden.png       what the render should look like
    figma-node.json  figma fixtures: the raw node, for offline import replay
    *.png, *.woff2   images and fonts the fixture uses
  fonts-private/     gitignored: fonts whose license forbids redistribution
  out/               gitignored: renders, heatmaps and report.json
```

## fixture.json

| Key            | Meaning                                                                                                                                                                                      |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`         | The folder name                                                                                                                                                                              |
| `kind`         | `"figma"` (golden exported from Figma), `"starter"` (golden blessed from today's Chromium render) or `"synthetic"` (a schema built in code, golden blessed from Chromium, for export parity) |
| `source`       | figma: `{ fileKey, nodeId }`, the node the golden comes from                                                                                                                                 |
| `schema`       | figma: the `TemplateSchema`, built by hand from exact Figma values with the properties that exist today                                                                                      |
| `values`       | Field values (default none)                                                                                                                                                                  |
| `brandKit`     | The kit the schema renders with (default none)                                                                                                                                               |
| `fonts`        | `[{ family, file, weight, style }]`; `file` is a name beside the fixture or a root-relative URL                                                                                              |
| `variantId`    | The colourway to render                                                                                                                                                                      |
| `emptyFields`  | `"placeholder"` (default), `"hideOptional"` or `"chat"`                                                                                                                                      |
| `unsupported`  | Ingredients the schema can't express today, each with its reason                                                                                                                             |
| `baseline`     | `{ chromium?, firefox?, webkit? }`: changed share in percent, recorded only with CJ's approval                                                                                               |
| `blurBaseline` | The same for the blurred share (after a 4px blur of both images), recorded only with CJ's approval                                                                                           |
| `goldenFrom`   | Compare with another fixture's `golden.png`: the same Figma frame rebuilt a second way                                                                                                       |
| `tolerance`    | Points a run may exceed its baseline by (default 0.25)                                                                                                                                       |

A starter fixture carries no schema. Its name is `starter-<starterKey>`, or `starter-<starterKey>-dark` with `variantId: "dark"`, and the dev render page materializes that blueprint against the sample workspace in `scripts/new-look/fixtures/dev-workspace.json`. A starter fixture can instead take any name and give its blueprint with `starter: "<starterKey>"`; it then renders with its own `values` and `variantId` (the `line-breaks-launch` fixtures fill `launch-01` with member text).

Images and fonts are referenced by root-relative URLs (`/test/fidelity/fixtures/<name>/grain.png`), which Vite serves in dev. Commit a font only when its license allows redistribution; otherwise put it in `fonts-private/`, and the runner reports the fixture as skipped, never as passed.

## Goldens

- figma: `node scripts/fidelity/goldens.mjs fetch <name>` (needs `FIGMA_TOKEN`). `goldens.mjs asset <name> <nodeId> <file.png>` exports another node of the same file beside the fixture.
- starter: `node scripts/fidelity/fidelity.mjs bless <name>`.

Only CJ approves a new golden or baseline.

## The two shares

The changed share counts pixels where any channel differs by more than 6. The blurred share does the same after a 4px blur of both images, which keeps tone and shadow and drops grain speckle: two grain patterns never match pixel for pixel, so a perfect grain still scores high on the changed share. A fixture with a `blurBaseline` fails when either share gets worse than its baseline.

## What the compare can't see

The compare is the shots.mjs one: RGB only, a channel off by more than 6. It ignores alpha, so a transparent pixel and an opaque black one compare equal. `gtm-composer`'s transparent corners are therefore not measured; a render that painted them black would score the same.
