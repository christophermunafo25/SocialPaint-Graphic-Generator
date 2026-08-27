// Handing a finished graphic to LinkedIn.
//
// What LinkedIn actually allows, because it shapes everything below:
//
//   * There is NO way to attach an image from a URL. LinkedIn's share
//     endpoints take text or a link, never a file. The person posting has to
//     attach the PNG themselves, and the UI has to say so rather than let
//     them discover it in the composer.
//   * The documented endpoint (`/sharing/share-offsite/`) accepts a URL and
//     nothing else — it cannot carry a caption at all. It is the wrong tool
//     here: we are not sharing a page, we are handing over a caption.
//   * `/feed/?shareActive=true&text=…` opens the composer with the text
//     filled in. It works today and is what every tool in this space uses,
//     but it is undocumented, so it is treated as best-effort: the caller
//     copies the caption to the clipboard at the same moment, and a person
//     whose composer comes up empty can paste instead of retyping.

/** LinkedIn caps a post at 3000 characters. Trimming just under that keeps
 * the composer from silently rejecting a long caption, and keeps the URL to
 * a length every browser handles. */
export const MAX_POST_CHARS = 2900;

const COMPOSER = "https://www.linkedin.com/feed/";

/** The composer URL for a caption. An empty caption still returns a usable
 * URL — the composer opens blank, which is the honest outcome for a template
 * with no caption rather than a dead button. */
export function linkedInComposerUrl(caption: string): string {
  const params = new URLSearchParams({ shareActive: "true" });
  const text = caption.trim().slice(0, MAX_POST_CHARS);
  if (text) params.set("text", text);
  return `${COMPOSER}?${params.toString()}`;
}

/** Open the composer and put the caption on the clipboard in one gesture.
 *
 * Order matters: `window.open` runs FIRST and synchronously, because a popup
 * blocker only honours a window opened in the same task as the click. The
 * clipboard write is fired after and never awaited — it is the safety net,
 * not the point, and a browser that refuses it must not cost the person
 * their tab.
 *
 * Returns false when the window was blocked, so the caller can say something
 * useful instead of appearing to do nothing.
 */
export function openLinkedInComposer(caption: string): boolean {
  const opened = window.open(linkedInComposerUrl(caption), "_blank", "noopener,noreferrer");
  if (caption.trim()) {
    void navigator.clipboard?.writeText(caption).catch(() => undefined);
  }
  return opened !== null;
}
