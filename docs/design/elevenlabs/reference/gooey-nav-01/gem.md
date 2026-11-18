## Overview

**Gooey Nav Indicator** is a horizontal nav bar with a liquid pill that slides between
links. As the pill travels, a trailing "drop" lags behind it and the two fuse into one
stretchy blob — like mercury pulling itself into shape — then snap crisply onto whichever
link you hover, focus, or click. Reach for it on a compact top nav or tab strip where you
want the active state to feel alive instead of static.

## How to use it

No build step, no libraries. It's plain HTML, CSS, and a tiny scoped script.

1. Copy `index.html`, `assets/style.css`, `assets/script.js`, and `assets/byq-brand.css`
   into one folder.
2. Open `index.html` in any modern browser.

There's no `assets/medias/` folder here — the effect is drawn entirely with CSS and an
inline SVG filter, so there are no images to ship. Keep `assets/byq-brand.css` on the
page: it supplies the BYQ brand tokens (colors, fonts, radii) that every rule references.

## The HTML

The whole gem is one namespaced `<section>`: a `<nav>` holding the goo layer plus the
list of links, followed by a zero-size `<svg>` that defines the filter.

```html
<section class="byq-gem byq-gem--gooey-nav-01">
  <nav class="byq-gem--gooey-nav-01__nav" aria-label="Sections">
    <span class="byq-gem--gooey-nav-01__goo" aria-hidden="true">
      <span class="byq-gem--gooey-nav-01__blob"></span>
      <span class="byq-gem--gooey-nav-01__drop"></span>
    </span>
    <ul class="byq-gem--gooey-nav-01__list">
      <li class="byq-gem--gooey-nav-01__item">
        <a class="byq-gem--gooey-nav-01__link is-active" href="#" aria-current="page">Studio</a>
      </li>
      <!-- Catalog, Gems, Journal, Contact … -->
    </ul>
  </nav>

  <svg class="byq-gem--gooey-nav-01__filter" aria-hidden="true" width="0" height="0">
    <defs>
      <filter id="byq-gooey-nav-01-goo">
        <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="blur" />
        <feColorMatrix in="blur" mode="matrix"
          values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -10" />
      </filter>
    </defs>
  </svg>
</section>
```

The `__goo` span holds two shapes: `__blob` (the pill) and `__drop` (the trailing
metaball). They sit *behind* the links. The `__link.is-active` class marks which link
currently owns the pill. That `<filter>` is the classic metaball trick — blur the shapes,
then use `feColorMatrix` to crank up alpha contrast so overlapping blurred edges snap into
one solid liquid mass.

## The CSS

Every selector is prefixed with `.byq-gem--gooey-nav-01` so nothing leaks out. The goo
layer is where the filter is applied.

```css
.byq-gem--gooey-nav-01__goo {
  position: absolute;
  inset: 0.4rem;
  z-index: 0;
  pointer-events: none;
  filter: url(#byq-gooey-nav-01-goo);
}
```

Applying `filter: url(...)` to the parent means both children get blurred and merged
*together* — that's what lets the pill and drop fuse. The links live in a sibling `__list`
with `z-index: 1`, so text stays sharp on top of the liquid.

The pill reads two custom properties the script sets — `--x` (horizontal offset) and `--w`
(width) — and eases between them with a springy curve.

```css
.byq-gem--gooey-nav-01__blob {
  width: var(--w, 5rem);
  background: var(--byq-accent-lime);
  transform: translateX(var(--x, 0px));
  transition:
    transform 0.55s cubic-bezier(0.16, 1, 0.3, 1),
    width 0.55s cubic-bezier(0.16, 1, 0.3, 1);
}
```

The drop chases the pill's centre via `--dx`, and `--ds` scales it from `0` (hidden) to
`1` (visible). Its transition is slightly slower with a bouncier `cubic-bezier`, so it
lags during travel and stretches a liquid bridge between the two.

```css
.byq-gem--gooey-nav-01__drop {
  transform: translateX(var(--dx, 0px)) scale(var(--ds, 0));
  transition: transform 0.62s cubic-bezier(0.34, 1.4, 0.5, 1);
}
```

The resting link flips to `color: var(--byq-on-accent)` so its text reads dark against the
lime pill. A `prefers-reduced-motion` block cuts transition duration to `0.001ms` so the
pill snaps instead of flowing.

## The JavaScript

The script is scoped to the gem root and drives everything through those CSS variables —
all the easing stays in the stylesheet.

**1. Grab the parts.** After `DOMContentLoaded`, it finds the root, the goo, blob, drop,
nav, and the list of links, bailing out if anything is missing.

```js
const root = document.querySelector(".byq-gem--gooey-nav-01");
const goo = root.querySelector(".byq-gem--gooey-nav-01__goo");
const blob = root.querySelector(".byq-gem--gooey-nav-01__blob");
const drop = root.querySelector(".byq-gem--gooey-nav-01__drop");
const links = [...root.querySelectorAll(".byq-gem--gooey-nav-01__link")];
```

**2. Measure and move.** `moveTo(link, animate)` uses `getBoundingClientRect()` to work out
the target's position *relative to the goo layer*, then writes `--x` and `--w` onto the
pill and toggles `is-active` onto that link.

```js
const gooRect = goo.getBoundingClientRect();
const rect = link.getBoundingClientRect();
const x = rect.left - gooRect.left;
const centre = x + rect.width / 2;
blob.style.setProperty("--x", `${x}px`);
blob.style.setProperty("--w", `${rect.width}px`);
```

**3. Pop the drop.** When `animate` is on (and motion is allowed), it parks the drop at the
pill's `centre` and scales it up with `--ds: 1`. A `settleTimer` of `260ms` later collapses
it back with `--ds: 0`, so the bridge only appears mid-travel.

```js
drop.style.setProperty("--dx", `${centre}px`);
drop.style.setProperty("--ds", "1");
settleTimer = window.setTimeout(() => {
  drop.style.setProperty("--ds", "0");
}, 260);
```

**4. Wire the events.** `mouseenter` and `focus` preview a link; `click` sets it as the new
`activeLink`; the nav's `mouseleave` returns the pill home. On first paint a
`requestAnimationFrame(settle)` places the pill with no stretch, and a `resize` listener
re-measures since link geometry shifts with the layout.

## Make it yours

- **Pill and drop color:** both use `var(--byq-accent-lime)` in `style.css` — swap to
  `var(--byq-accent-solar)` (or any brand token) to re-tint the indicator.
- **Gooeyness:** raise `stdDeviation="7"` on the `feGaussianBlur` for a softer, stretchier
  blob; the `22 -10` alpha values on `feColorMatrix` control how hard the merge snaps.
- **Travel feel:** edit the `0.55s` / `0.62s` durations and the `cubic-bezier` curves on
  `__blob` and `__drop` — a bouncier drop curve exaggerates the liquid lag.
- **Bridge timing:** the `260ms` `settleTimer` in `script.js` decides how long the drop
  trails before collapsing. Longer keeps the goo visible more of the trip.
- **Drop size:** `__drop` is `1.6rem` square; a bigger drop makes a thicker liquid bridge.
- **Links:** add or remove `<li>` items — the script measures whatever links exist, so no
  code changes are needed.
