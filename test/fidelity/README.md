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
  google-fonts/      Google's recorded answers to the fixtures' font requests
  out/               gitignored: renders, heatmaps and report.json
```

## fixture.json

| Key            | Meaning                                                                                                                                                                                                                                                                     |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`         | The folder name                                                                                                                                                                                                                                                             |
| `kind`         | `"figma"` (golden exported from Figma), `"starter"` (golden blessed from today's Chromium render) or `"synthetic"` (a schema built in code, golden blessed from Chromium, for export parity), or `"import"` (a saved Figma tree replayed through the real importer offline) |
| `source`       | figma: `{ fileKey, nodeId }`, the node the golden comes from                                                                                                                                                                                                                |
| `schema`       | figma: the `TemplateSchema`, built by hand from exact Figma values with the properties that exist today                                                                                                                                                                     |
| `figmaNode`    | import: root-relative URL of the saved node tree the replay walks                                                                                                                                                                                                           |
| `assets`       | import: each Figma render (by node id) and image fill (by image ref) the replay needs, as a file beside the fixture                                                                                                                                                         |
| `values`       | Field values (default none)                                                                                                                                                                                                                                                 |
| `brandKit`     | The kit the schema renders with (default none)                                                                                                                                                                                                                              |
| `fonts`        | `[{ family, file, weight, style }]`; `file` is a name beside the fixture or a root-relative URL                                                                                                                                                                             |
| `variantId`    | The colourway to render                                                                                                                                                                                                                                                     |
| `emptyFields`  | `"placeholder"` (default), `"hideOptional"` or `"chat"`                                                                                                                                                                                                                     |
| `unsupported`  | Ingredients the schema can't express today, each with its reason                                                                                                                                                                                                            |
| `baseline`     | `{ chromium?, firefox?, webkit? }`: changed share in percent, recorded only with CJ's approval                                                                                                                                                                              |
| `blurBaseline` | The same for the blurred share (after a 4px blur of both images), recorded only with CJ's approval                                                                                                                                                                          |
| `goldenFrom`   | Compare with another fixture's `golden.png`: the same Figma frame rebuilt a second way                                                                                                                                                                                      |
| `tolerance`    | Points a run may exceed its baseline by (default 0.25)                                                                                                                                                                                                                      |

A starter fixture carries no schema. Its name is `starter-<starterKey>`, or `starter-<starterKey>-dark` with `variantId: "dark"`, and the dev render page materializes that blueprint against the sample workspace in `scripts/new-look/fixtures/dev-workspace.json`.

Images and fonts are referenced by root-relative URLs (`/test/fidelity/fixtures/<name>/grain.png`), which Vite serves in dev. Commit a font only when its license allows redistribution; otherwise put it in `fonts-private/`, and the runner reports the fixture as skipped, never as passed.

## Goldens

- figma: `node scripts/fidelity/goldens.mjs fetch <name>` (needs `FIGMA_TOKEN`). `goldens.mjs asset <name> <nodeId> <file.png>` exports another node of the same file beside the fixture.
- starter: `node scripts/fidelity/fidelity.mjs bless <name>`.
- import: none of its own; `goldenFrom` names the figma fixture of the same frame. A replay that lacks a render or fill fails and names each one; fetch them with `goldens.mjs asset <name> <nodeId> <file.png>` and `goldens.mjs fill <name> <imageRef> <file>`, and list them under `assets`.

Only CJ approves a new golden or baseline.

## The two shares

The changed share counts pixels where any channel differs by more than 6. The blurred share does the same after a 4px blur of both images, which keeps tone and shadow and drops grain speckle: two grain patterns never match pixel for pixel, so a perfect grain still scores high on the changed share. A fixture with a `blurBaseline` fails when either share gets worse than its baseline.

## What the compare can't see

The compare is the shots.mjs one: RGB only, a channel off by more than 6. It ignores alpha, so a transparent pixel and an opaque black one compare equal. `gtm-composer`'s transparent corners are therefore not measured; a render that painted them black would score the same.

## Firefox's one changed setting

The harness launches Firefox with `nglayout.initialpaint.delay` set to 40 (stock is 5), so the Firefox numbers come from a Firefox that is not on stock settings. Chromium and WebKit run as shipped. The pref does not change what a correct export renders: the baselines recorded before it was set still hold.

Firefox suppresses painting for that many milliseconds at the start of every document's life, the export snapshot's own document included. A snapshot drawn inside the window comes out without anything clipped to text (a text gradient, grain on glyphs), and Firefox keeps that raster, so a later draw cannot repair it. At 5 ms an export that draws too early loses the race only on a slow machine, which showed as an occasional `builder-roundtrip` failure on CI. At 40 ms, longer than a frame, it loses on every run.

The export waits `SNAPSHOT_SETTLE_MS` (50 ms, `src/lib/render/exportPng.ts`) before its first draw. The harness value (`FIREFOX_PAINT_DELAY_MS` in `scripts/fidelity/fidelity.mjs`) must stay below that wait, or every Firefox run loses its text-clipped fills.

## WebKit's photo rows need the decode in the draw

The export sets `decoding="sync"` on every `<img>` in its snapshot (`withSyncDecodedImages`, `src/lib/render/snapshotDecoding.ts`), so WebKit decodes a photo whole inside the draw and scales it as it paints. Without the attribute WebKit decodes a large photo off the main thread at the size it is drawn, and the pixels differ wherever a photo is drawn smaller than it is. Chromium and Firefox render the same pixels either way.

Three WebKit baselines were recorded with the attribute in place (approved by CJ on 2026-11-17), and each row fails without it:

| Fixture                    | With it (changed / blurred) | Without it   |
| -------------------------- | --------------------------- | ------------ |
| `crop-matrix`              | 2.01 / 0.00                 | 11.58 / 0.09 |
| `gtm-composer-import`      | 2.80 / 0.53                 | 6.19 / 0.54  |
| `feature-highlight-import` | 5.04 / 10.74                | 6.04 / 10.74 |

When all three read the right-hand numbers, the attribute no longer reaches the snapshot. Either the export stopped setting it, or the edited snapshot failed to load and the export fell back to the one html-to-image made, which it logs as an error.

The rows do not cover an image field's alpha mask. A mask is a CSS image, which has no such attribute, so WebKit still decodes it after the first draw, and the export still depends on its 150 ms pause (`WARM_UP_PAUSE_MS`) for it. A WebKit row whose masked photo is missing from the render has lost that race, not the attribute.

## Google's fonts are recorded

The harness never asks Google for a font. Every request a fixture's page makes to `fonts.googleapis.com` or `fonts.gstatic.com` is answered from `google-fonts/`: `recording.json` maps each engine's requests to the bodies in `files/`, which are named by their content. `scripts/fidelity/fontRecording.mjs` does the answering, for `run`, `bless` and `baseline` alike.

The export fetches a family's stylesheet again at export time and embeds the files it names, and Google does not answer every request alike. A few percent of the time it names a second build of the same font version, whose letters land up to a pixel apart. Asked live, that moved `feature-highlight-import` on WebKit by 0.15 points with no code change. On the recording every row reads its baseline.

A request the recording lacks is failed. Its row reports `error`, and the run and `report.json` name the request. That happens when a fixture asks for a family, or a set of faces of one, that no fixture asked for before, and when a change alters which stylesheets the app asks Google for: the css2 query in `src/lib/render/fonts.ts`, or the Google `@import` in `src/styles/socialpaint.css` (a test in `npm run verify` catches that one). Then run

```bash
node scripts/fidelity/fidelity.mjs fonts
```

and commit `google-fonts/`. It renders the fixtures into `out/fonts/`, fetches the answers the recording lacks, and never fetches one it already has. It keeps only a stylesheet, a font file, or Google's 400 for a family it does not serve. Anything else, such as an outage or a rate limit, is reported and the command exits non-zero, so run it again. When it has rendered every fixture in every engine it also drops the answers none of them asked for. A run narrowed with `--only`, or to fewer than three engines, drops nothing.

A fixture skipped for a missing font file is left out of both: what its page asks Google for is neither reported nor recorded.

To move a family to Google's current build, delete that family's `css2` answers from `recording.json` (or the whole file, for every family) and run `fonts`. That can move rows, so it needs the baselines re-measured with CJ's approval.

Each recorded family is under the SIL Open Font License, and `google-fonts/licenses/` has a copy for each. When `fonts` records a family for the first time, check that its license allows redistribution and add its copy there.
