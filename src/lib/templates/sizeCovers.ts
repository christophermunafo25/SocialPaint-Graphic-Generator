/** Cover art for the size gallery. Files in src/assets/sizes/ are named by
 *  SIZE_CATALOG id, so a dropped file wires itself up with zero code changes
 *  — and the colocated test fails CI on a filename that matches no catalogue
 *  id, rather than letting a misspelling silently never render.
 *
 *  Inlined (?raw), never <img>: an SVG in its own document can only see
 *  prefers-color-scheme, so a manual light/dark override in the app
 *  (colorScheme.tsx) would leave the mock inverted. Inline, the app's
 *  --cover-* tokens win over each file's own fallbacks. */
const covers = import.meta.glob("/src/assets/sizes/*.svg", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

const byId = new Map(
  Object.entries(covers).map(([path, svg]) => {
    const file = path.split("/").pop() ?? path;
    return [file.replace(/\.svg$/, ""), svg];
  }),
);

/** Every size id that shipped with cover art, sorted for stable assertions. */
export const coverIds = (): string[] => [...byId.keys()].sort();

/** The raw SVG markup for one size's cover, or undefined — the gallery then
 *  draws its proportional outline fallback on the same plate. */
export const coverFor = (sizeId: string): string | undefined => byId.get(sizeId);
