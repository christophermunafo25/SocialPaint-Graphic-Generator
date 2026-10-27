import dynamicIconImports from "lucide-react/dynamicIconImports";
import type { FieldVector } from "../types";
import { DEFAULT_ICON_WEIGHT, iconNodeToVector, type LucideElement } from "./lucide";

const loaders = dynamicIconImports as Record<string, () => Promise<unknown>>;

/** True when a name is one of Lucide's old aliases: its loader imports
 * another icon's own file. The file name is read from the loader's import
 * path (with a build's 8-character hash removed); a path that names no
 * other icon, such as a shared app chunk, counts as the icon itself. */
function isAlias(name: string): boolean {
  const file = /\/([\w-]+)\.js/.exec(String(loaders[name]))?.[1];
  if (!file || file === name) return false;
  const unhashed = file.replace(/-[\w-]{8}$/, "");
  const target = Object.prototype.hasOwnProperty.call(loaders, file) ? file : unhashed;
  return target !== name && Object.prototype.hasOwnProperty.call(loaders, target);
}

/** Every Lucide icon name once, in Lucide's order (old aliases left out).
 * Each icon's drawing loads on first use, so the builder never ships the
 * whole set. */
export const LUCIDE_NAMES: readonly string[] = Object.keys(loaders).filter((n) => !isAlias(n));

const nodes = new Map<string, Promise<readonly LucideElement[] | null>>();

/** One icon's elements, loaded once and shared by every caller. */
export function loadLucideNode(name: string): Promise<readonly LucideElement[] | null> {
  let pending = nodes.get(name);
  if (!pending) {
    // Own keys only: a stored name like "constructor" is not an icon.
    const load = Object.prototype.hasOwnProperty.call(loaders, name) ? loaders[name] : undefined;
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
