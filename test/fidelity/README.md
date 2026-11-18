# Fidelity fixtures

The render fidelity harness (`docs/brand-system/PHASE-0.md`) renders each fixture through the real export path in Chromium, Firefox, WebKit and an older WebKit (`webkit18`, below) and compares it with a golden. `src/app/dev/fidelity.ts` holds the type, `FidelityFixture`.

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
| `baseline`     | `{ chromium?, firefox?, webkit?, webkit18? }`: changed share in percent, recorded only with CJ's approval                                                                                                                                                                   |
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

## The WebKit rows are not Safari before 26

The harness's WebKit is the build Playwright ships, 26.6 today. Safari 18 and older paint some things differently, on screen and in the export, and no `webkit` row can catch that. The `webkit18` rows, below, are an older WebKit's, and can.

Two differences are handled in the renderer. Both come from how Safari before 26 clips what it paints under a filter. Safari 26 has neither, and WebKit bug 219520 is the change that removed them.

The first is a clip that never arrives. Safari before 26 stops clipping the layers it paints straight from an element whose filter moves pixels (a drop shadow or a blur). On an image field that was a cropped photo, drawn whole over its frame and its corners, and an inner shadow with no blur, whose ring was drawn outside the photo. On a rect shape, which carries its filter itself, it was the same unblurred inner shadow. So an image field's clipping box is its own stacking context whenever an effects wrapper holds it (`WRAPPED_IMAGE_BOX`, `src/app/components/SchemaRenderer.tsx`), and so is a field's inner shadow overlay when it holds an unblurred frame (`BoxOverlay`, the same file). That puts those layers back inside one that clips.

The second is a ring that is never painted. An inner shadow is a blurred ring whose hole is the box, moved by the offset and shrunk by the spread. Safari before 26 hands a filtered layer a paint rectangle already cut by its ancestors' clip, and skips a border whose inner edge contains that rectangle. Along an axis where no offset moves the hole and no spread shrinks it, the hole's two edges sat exactly on the box's. With both axes like that the hole contained the whole of a square-cornered box, so the shadow never showed: every canvas inner shadow without an offset. With one axis like that, the same happened to a box the canvas cuts off on the side the offset moves the hole away from, by at least the offset. On such an axis the hole's edges now sit 0.02 px inside the box, whatever its corners (`FLUSH_EDGE_INSET_PX`, `src/lib/render/effects.ts`).

`SchemaRenderer.effects.test.tsx` and `effects.test.ts` hold that markup. They cannot show that Safari draws it right.

| On Safari 18.6's engine, changed / blurred | Before        | With the fix | WebKit 26, the row's baseline |
| ------------------------------------------ | ------------- | ------------ | ----------------------------- |
| `crop-matrix`, the crop under a shadow     | 12.78 / 12.81 | 1.87 / 0.00  | 2.01 / 0.00                   |
| `effects-matrix`, a canvas inner shadow    | 15.11 / 14.66 | 1.46 / 1.13  | 2.12 / 2.05                   |
| `builder-roundtrip`, a canvas inner shadow | 13.62 / 15.39 | 0.49 / 2.27  | 0.73 / 1.99                   |

Those numbers are this harness's compare on exports made by the system WebKit of a Mac on Safari 18.6 (2026-11-17 and 18), driven by a helper kept outside the repo. No committed fixture has a crop under a layer blur, an unblurred inner shadow under a drop shadow or a blur, or an inner shadow on a box the canvas cuts off. Those were seen in temporary fixtures, wrong before and right with the fix. A change to how a field is clipped, filtered or given effects gets that check from the `webkit18` rows for what the fixtures hold, and needs a Safari before 26 for the rest.

Measured on 18.6 and not handled:

- An inner shadow is still not drawn on a box that bleeds off all four edges of the canvas (measured with a shadow that has no offset). By the same mechanism that should hold for any box cut off along both axes with its hole reaching past what is left on every side. Only the first was measured.
- A flipped field's drop shadow falls on the side it would without the flip.
- A field with opacity under 100 and a drop shadow is darker inside its box.
- The lower lines of a multiline paragraph sit about a pixel off.

### webkit18, a WebKit from before the change

The harness's fourth engine is the WebKit that Playwright 1.53.0 shipped: build 2182, which calls itself 18.5 and is dated 3 June 2025, four weeks before bug 219520 was fixed. It has both differences above. `scripts/fidelity/webkit18.mjs` says how it is driven, and installs it, once on each machine:

```bash
node scripts/fidelity/webkit18.mjs install
```

A run that cannot find it stops before it renders anything and names that command. The install has a checksum for one archive, which Apple silicon on macOS 15 and later takes. Anywhere else it refuses, and `--engines chromium,firefox,webkit` runs the other three.

It is not Safari, and it draws like it. On 2026-11-18, 21 of the 24 fixtures came out of it pixel for pixel as they came out of Safari 18.6's own engine. The other three differ in the grain on an ellipse (`effects-matrix`, 0.62% of the picture), in the grain on an icon (`icons-matrix`, 0.01%), and by one level in 123 pixels of one of `crop-matrix`'s photos. In the two grain fields it draws exactly what WebKit 26.6 draws, so that difference lies between Playwright's builds and Safari's own. Three renders of each fixture, and a fourth under `taskpolicy -b`, were byte for byte the same.

Five temporary fixtures (crops, masks, flips, opacity, grain on a photo, unblurred inner shadows, boxes the canvas cuts off or that bleed off every edge) came out of it identical to Safari 18.6's engine in every pixel. That includes the first three things on the list above, which it draws wrong exactly as Safari 18.6 does.

One fault of its own is known. An inner shadow in an opaque colour on a box with rounded corners comes out weaker in it than in Safari 18.6 and WebKit 26.6, which draw it alike: about an eighth of a 140 px box with 40 px corners is over the compare's threshold. With a semi-transparent colour all three agree to the pixel, and with square corners to within one level in six pixels. Every inner shadow in the fixtures is semi-transparent, so no row shows it.

Before the two fixes it read three rows 11 to 14 points worse, and the other 21 as it reads them now:

| In webkit18, changed / blurred | Before the fixes | With them   |
| ------------------------------ | ---------------- | ----------- |
| `crop-matrix`                  | 12.78 / 12.81    | 1.87 / 0.00 |
| `effects-matrix`               | 14.50 / 14.66    | 0.85 / 1.13 |
| `builder-roundtrip`            | 13.62 / 15.39    | 0.49 / 2.27 |

Those are the numbers of the Mac they were measured on (macOS 15.6). On CI's runner (macOS 26) `builder-roundtrip` has read 0.48 / 2.27. `effects-matrix` read 0.81 / 1.10 in two runs and its baseline in a third. The other 22 rows have read the same there as here, to two decimals.

Its 24 baselines were recorded on 2026-11-18 with CJ's approval, on the commit that has both fixes. A baseline records what this engine draws, not what is right: a fixture that held one of the first three things on the list above would hold the wrong picture as its `webkit18` baseline. A new fixture needs a `webkit18` baseline like any other.

It is given WebKit's recorded fonts: its page asks Google for the same stylesheets, and with WebKit's answers it drew every fixture's text as Safari 18.6 drew it from Google itself. `fonts` leaves it out, and refuses it when it is named. A request only it made would fail its row and could not be recorded this way, which would be the day to give it a recording of its own.

## Google's fonts are recorded

The harness never asks Google for a font. Every request a fixture's page makes to `fonts.googleapis.com` or `fonts.gstatic.com` is answered from `google-fonts/`: `recording.json` maps each engine's requests to the bodies in `files/`, which are named by their content. `scripts/fidelity/fontRecording.mjs` does the answering, for `run`, `bless` and `baseline` alike.

The export fetches a family's stylesheet again at export time and embeds the files it names, and Google does not answer every request alike. A few percent of the time it names a second build of the same font version, whose letters land up to a pixel apart. Asked live, that moved `feature-highlight-import` on WebKit by 0.15 points with no code change. On the recording every row reads its baseline.

A request the recording lacks is failed. Its row reports `error`, and the run and `report.json` name the request. That happens when a fixture asks for a family, or a set of faces of one, that no fixture asked for before, and when a change alters which stylesheets the app asks Google for: the css2 query in `src/lib/render/fonts.ts`, or the Google `@import` in `src/styles/socialpaint.css` (a test in `npm run verify` catches that one). Then run

```bash
node scripts/fidelity/fidelity.mjs fonts
```

and commit `google-fonts/`. It renders the fixtures into `out/fonts/`, fetches the answers the recording lacks, and never fetches one it already has. It keeps only a stylesheet, a font file, or Google's 400 for a family it does not serve. Anything else, such as an outage or a rate limit, is reported and the command exits non-zero, so run it again. When it has rendered every fixture in each of the three engines it records for, it also drops the answers none of them asked for. A run narrowed with `--only`, or to fewer than those three, drops nothing.

A fixture skipped for a missing font file is left out of both: what its page asks Google for is neither reported nor recorded.

To move a family to Google's current build, delete that family's `css2` answers from `recording.json` (or the whole file, for every family) and run `fonts`. That can move rows, so it needs the baselines re-measured with CJ's approval.

Each recorded family is under the SIL Open Font License, and `google-fonts/licenses/` has a copy for each. When `fonts` records a family for the first time, check that its license allows redistribution and add its copy there.
