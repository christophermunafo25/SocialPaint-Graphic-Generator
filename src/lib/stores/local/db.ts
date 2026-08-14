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
    const upgraded = normalizeLegacyTextSizing(db);
    if (bakeLegacyColorKeys(db) || upgraded) writeDb(db);
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

/** Bake legacy field-level brand color bindings (prompt 23): fields no
 * longer reference the palette live, so a lingering colorKey resolves
 * against the company's kit ONCE, writes the hex, and clears. Exactly what
 * the renderer showed — an unresolvable key keeps the colorHex fallback.
 * Type-style colorKey stays: styles are the sanctioned live channel. */
function bakeLegacyColorKeys(db: Db): boolean {
  let changed = false;
  const kits = db.brandKits as Array<{
    companyId?: string;
    colors?: Array<{ key: string; hex: string }>;
  }>;
  for (const t of db.templates as Array<{ companyId?: string; fields?: unknown[] }>) {
    const colors = kits.find((k) => k.companyId === t.companyId)?.colors ?? [];
    for (const raw of t.fields ?? []) {
      const f = raw as Record<string, unknown>;
      if (typeof f.colorKey !== "string") continue;
      const hex = colors.find((c) => c.key === f.colorKey)?.hex;
      if (hex) f.colorHex = hex;
      delete f.colorKey;
      changed = true;
    }
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
