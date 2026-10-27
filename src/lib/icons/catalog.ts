import dynamicIconImports from "lucide-react/dynamicIconImports";
import type { FieldVector } from "../types";
import { DEFAULT_ICON_WEIGHT, iconNodeToVector, type LucideElement } from "./lucide";

/** Every Lucide icon name, in Lucide's order. Each icon's drawing loads on
 * first use, so the builder never ships the whole set. */
export const LUCIDE_NAMES: readonly string[] = Object.keys(dynamicIconImports);

const nodes = new Map<string, Promise<readonly LucideElement[] | null>>();

/** One icon's elements, loaded once and shared by every caller. */
export function loadLucideNode(name: string): Promise<readonly LucideElement[] | null> {
  let pending = nodes.get(name);
  if (!pending) {
    const load = (dynamicIconImports as Record<string, () => Promise<unknown>>)[name];
    pending = load
      ? load()
          .then((m) => ((m as { __iconNode?: LucideElement[] }).__iconNode ?? null) as never)
          .catch(() => null)
      : Promise.resolve(null);
    nodes.set(name, pending);
  }
  return pending;
}

/** A Lucide icon as an icon field's vector, or null if it can't load. */
export async function loadLucideVector(
  name: string,
  weight = DEFAULT_ICON_WEIGHT,
): Promise<FieldVector | null> {
  const node = await loadLucideNode(name);
  return node ? iconNodeToVector(name, node, weight) : null;
}
