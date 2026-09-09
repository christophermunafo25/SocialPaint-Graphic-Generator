/** Splice a reordered subset back into the full array without moving
 * anything that was not in the subset.
 *
 * The Form tab shows only member-facing fields, but `onReorder` must emit
 * the WHOLE fields array: fixed elements and shapes still live in it, and
 * dropping one would delete it from the template. So the visible fields
 * keep the set of absolute indices they already occupied, and only the
 * assignment of field to index changes.
 *
 * `key` names an item; two items are the same when their keys match. A
 * `nextVisible` that adds or drops a key is refused outright and the
 * original array comes back untouched, because the only alternative is a
 * lossy write. */
export function mergeVisibleOrderBy<T>(
  all: readonly T[],
  nextVisible: readonly T[],
  key: (item: T) => string,
): T[] {
  const visibleKeys = new Set(nextVisible.map(key));
  const slots: number[] = [];
  all.forEach((item, i) => {
    if (visibleKeys.has(key(item))) slots.push(i);
  });
  if (slots.length !== nextVisible.length || visibleKeys.size !== nextVisible.length) {
    return [...all];
  }
  const out = [...all];
  slots.forEach((slot, k) => {
    out[slot] = nextVisible[k];
  });
  return out;
}

/** The fields case: items are keyed by id. */
export function mergeVisibleOrder<T extends { id: string }>(
  all: readonly T[],
  nextVisible: readonly T[],
): T[] {
  return mergeVisibleOrderBy(all, nextVisible, (f) => f.id);
}

/** The group-children case: a child ref is its own key. */
export function mergeVisibleRefs(all: readonly string[], nextVisible: readonly string[]): string[] {
  return mergeVisibleOrderBy(all, nextVisible, (ref) => ref);
}
