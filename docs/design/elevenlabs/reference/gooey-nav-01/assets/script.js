// Gooey Nav Indicator — original.
// The pill (.__blob) snaps to whichever link is hovered / focused / active,
// while a trailing drop (.__drop) chases its centre. The SVG goo filter in the
// markup fuses the two, so the indicator stretches like liquid while it travels
// and re-forms once it settles. All state is driven through CSS custom props,
// so the springy easing lives in the stylesheet. Scoped to root — no globals.
window.addEventListener("DOMContentLoaded", () => {
  const root = document.querySelector(".byq-gem--gooey-nav-01");
  if (!root) return;

  const goo = root.querySelector(".byq-gem--gooey-nav-01__goo");
  const blob = root.querySelector(".byq-gem--gooey-nav-01__blob");
  const drop = root.querySelector(".byq-gem--gooey-nav-01__drop");
  const nav = root.querySelector(".byq-gem--gooey-nav-01__nav");
  const links = [...root.querySelectorAll(".byq-gem--gooey-nav-01__link")];
  if (!goo || !blob || !drop || !nav || !links.length) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // The link that "owns" the pill when nothing is being pointed at.
  let activeLink = links.find((l) => l.classList.contains("is-active")) || links[0];
  let settleTimer = 0;

  // Move the pill under `link`. `animate` = show the liquid stretch mid-travel.
  function moveTo(link, animate) {
    const gooRect = goo.getBoundingClientRect();
    const rect = link.getBoundingClientRect();
    const x = rect.left - gooRect.left;
    const centre = x + rect.width / 2;

    blob.style.setProperty("--x", `${x}px`);
    blob.style.setProperty("--w", `${rect.width}px`);

    // Tint the resting link dark so its text reads against the lime pill.
    links.forEach((l) => l.classList.toggle("is-active", l === link));

    clearTimeout(settleTimer);

    if (animate && !reduced) {
      // Pop the drop up at the pill's centre; its springy, slightly slower
      // transition makes it lag, forming the goo bridge as the pill moves.
      drop.style.setProperty("--dx", `${centre}px`);
      drop.style.setProperty("--ds", "1");
      // Once travel finishes, collapse the drop back into the pill.
      settleTimer = window.setTimeout(() => {
        drop.style.setProperty("--ds", "0");
      }, 260);
    } else {
      drop.style.setProperty("--dx", `${centre}px`);
      drop.style.setProperty("--ds", "0");
    }
  }

  // Pointer + keyboard focus preview the target; leaving/blur returns home.
  links.forEach((link) => {
    link.addEventListener("mouseenter", () => moveTo(link, true));
    link.addEventListener("focus", () => moveTo(link, true));
    link.addEventListener("click", (e) => {
      e.preventDefault();
      activeLink = link;
      moveTo(link, true);
    });
  });

  nav.addEventListener("mouseleave", () => moveTo(activeLink, true));

  // Place the pill on first paint (no stretch), and re-place on resize since
  // link geometry changes with the layout.
  const settle = () => moveTo(activeLink, false);
  requestAnimationFrame(settle);
  window.addEventListener("resize", settle);
});
