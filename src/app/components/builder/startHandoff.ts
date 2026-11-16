import type { AutoBuildResult, DesignImportResult } from "@/lib/types";

/** How a new template starts, chosen on the Template Builder list (new
 * brand, Phase 6a): New template, then Choose a size or one of the import
 * dialogs. The list hands the choice to the builder, which takes it when it
 * opens on /template-builder/new.
 *
 * It is held here rather than in the address: an import's result is far too
 * large for a URL and means nothing after a reload, and a reload of
 * /template-builder/new, finding nothing handed over, goes back to the list
 * with New template open. */
export type BuilderStart =
  | { kind: "blank"; size: { width: number; height: number } }
  | { kind: "import"; result: DesignImportResult }
  | { kind: "build"; result: AutoBuildResult | DesignImportResult };

let pending: BuilderStart | null = null;
let newTemplateRequested = false;

/** The list hands a start over, just before it opens the builder. */
export function handOffStart(start: BuilderStart): void {
  pending = start;
}

/** What the builder will take, without taking it. The builder reads this
 * while it renders (twice, under StrictMode) and clears it in an effect. */
export function peekStart(): BuilderStart | null {
  return pending;
}

export function clearStart(): void {
  pending = null;
}

/** The builder, opened on /template-builder/new with nothing handed over,
 * asks the list to open New template when it gets there. */
export function requestNewTemplate(): void {
  newTemplateRequested = true;
}

/** The list takes the request once, as it mounts. */
export function takeNewTemplateRequest(): boolean {
  const requested = newTemplateRequested;
  newTemplateRequested = false;
  return requested;
}
