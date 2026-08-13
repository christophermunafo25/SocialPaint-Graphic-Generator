// Tiny localStorage-backed document store for the zero-backend dev mode.
// Selected automatically when VITE_SUPABASE_URL is unset — same interfaces,
// same UI code paths as the Supabase backend.

interface Db {
  companies: unknown[];
  brandKits: unknown[];
  brandAssets: unknown[];
  templates: unknown[];
  usageEvents: unknown[];
}

const KEY = "brand-portal-dev-db";

const empty = (): Db => ({
  companies: [],
  brandKits: [],
  brandAssets: [],
  templates: [],
  usageEvents: [],
});

export function readDb(): Db {
  try {
    const raw = localStorage.getItem(KEY);
    const db = raw ? { ...empty(), ...(JSON.parse(raw) as Db) } : empty();
    if (normalizeLegacyTextSizing(db)) writeDb(db);
    return db;
  } catch {
    return empty();
  }
}

/** One-time upgrade of legacy data — this store has no migration hook, so it
 * runs on read: the autoFit/fixedWidth booleans became textSizing ("shrink"
 * when either was set). Rewrites at most once; normalized data has no legacy
 * keys left to match. */
function normalizeLegacyTextSizing(db: Db): boolean {
  let changed = false;
  const upgrade = (o: Record<string, unknown>) => {
    if (!("autoFit" in o) && !("fixedWidth" in o)) return;
    if (o.autoFit === true || o.fixedWidth === true) o.textSizing = "shrink";
    delete o.autoFit;
    delete o.fixedWidth;
    changed = true;
  };
  for (const t of db.templates as Array<{ fields?: unknown[] }>) {
    for (const f of t.fields ?? []) upgrade(f as Record<string, unknown>);
  }
  for (const k of db.brandKits as Array<{ typeStyles?: unknown[] }>) {
    for (const s of k.typeStyles ?? []) upgrade(s as Record<string, unknown>);
  }
  return changed;
}

export function writeDb(db: Db): void {
  localStorage.setItem(KEY, JSON.stringify(db));
}

export function mutate<T>(fn: (db: Db) => T): T {
  const db = readDb();
  const result = fn(db);
  writeDb(db);
  return result;
}

export const newId = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const fileToDataUrl = (file: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
