import fallbackCover from "@/assets/sizes/fallback.webp";

/** Cover art for Choose a size (new brand, the Size Cover components beside
 *  327:1985). Files in src/assets/sizes/ are named by SIZE_CATALOG id, so a
 *  dropped file wires itself up with no code change, and the colocated test
 *  fails CI on a filename that matches no catalogue id rather than letting a
 *  misspelling silently never render. fallback.webp, the file's twelfth
 *  cover, stands in for every size without its own.
 *
 *  The covers are photographs on their own grounds, the same in both
 *  themes, so they load as images (WebP, exported from the file at 1x). */
const covers = import.meta.glob(["/src/assets/sizes/*.webp", "!/src/assets/sizes/fallback.webp"], {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const byId = new Map(
  Object.entries(covers).map(([path, url]) => {
    const file = path.split("/").pop() ?? path;
    return [file.replace(/\.webp$/, ""), url];
  }),
);

/** Every size id that shipped with cover art, sorted for stable assertions. */
export const coverIds = (): string[] => [...byId.keys()].sort();

/** The cover's URL for one size, or the fallback cover for a size without
 *  its own. */
export const coverFor = (sizeId: string): string => byId.get(sizeId) ?? fallbackCover;
