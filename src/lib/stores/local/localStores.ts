import { SIZE_CATALOG, type CanvasSize } from "../../templates/platforms";
import type {
  BrandAsset,
  BrandKit,
  Company,
  CompanyPatch,
  CompanyTemplateLink,
  DesignImportResult,
  MonthlyUsage,
  NewTemplateInput,
  PublicLinkUsageRow,
  TemplateSchema,
  TemplateStatus,
  UsageAction,
  UsageActor,
  UsageSummary,
  UsageSummaryRow,
} from "../../types";
import type {
  AccountStore,
  BrandAssetStore,
  BrandKitStore,
  CompanyStore,
  DesignImportProvider,
  GenerateProvider,
  PublicLinkStore,
  TemplateStore,
  UsageStore,
} from "../interfaces";
import { browserTimeZone } from "../../companySettings";
import { bucketDailyActivity } from "../dailyActivity";
import { joinCompanyLinks } from "../linkInventory";
import { monthStartIso, summarizeMonthlyUsage } from "../monthlyUsage";
import { joinLinkUsage } from "../publicLinkUsage";
import { fileToDataUrl, mutate, newId, readDb } from "./db";

interface UsageEventRec {
  id: string;
  companyId: string;
  templateId: string;
  action: UsageAction;
  userId: string | null;
  /** Mirrors the Supabase column so the Insights page exercises the same
   * branches on either backend. This store only ever WRITES "member" — it
   * has no Edge Functions and so no public links — but it reads whatever is
   * there rather than hardcoding zeroes, which would make the public half of
   * the dashboard unreachable in development. */
  actor?: UsageActor;
  /** Which public link produced the event, when one did. */
  linkId?: string | null;
  createdAt: string;
}

interface TemplateLinkRec {
  id: string;
  name: string;
  templateId: string;
  revokedAt?: string | null;
  createdAt: string;
}

/** Companies saved before the settings columns existed lack them — fill the
 * same defaults the migration would have. */
const normalizeCompany = (c: Partial<Company> & Company): Company => ({
  ...c,
  timezone: c.timezone ?? browserTimeZone(),
  linkDefaults: c.linkDefaults ?? { allowUploads: true, expiryDays: null, useCap: null },
});

interface CompanyPresetRec {
  companyId: string;
  presetId: string;
  enabled: boolean;
}

export class LocalCompanyStore implements CompanyStore {
  async list(): Promise<Company[]> {
    return (readDb().companies as Company[])
      .map(normalizeCompany)
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  async get(id: string): Promise<Company | null> {
    const found = (readDb().companies as Company[]).find((c) => c.id === id);
    return found ? normalizeCompany(found) : null;
  }
  async create(input: { name: string; slug: string }): Promise<Company> {
    const company: Company = {
      id: newId(),
      ...input,
      createdAt: new Date().toISOString(),
      timezone: browserTimeZone(),
      linkDefaults: { allowUploads: true, expiryDays: null, useCap: null },
    };
    mutate((db) => db.companies.push(company));
    return company;
  }
  async update(id: string, patch: CompanyPatch): Promise<Company> {
    return mutate((db) => {
      const companies = db.companies as Company[];
      const i = companies.findIndex((c) => c.id === id);
      if (i < 0) throw new Error(`Company ${id} not found`);
      companies[i] = { ...normalizeCompany(companies[i]), ...patch };
      return companies[i];
    });
  }
  /** Mirrors the schema's cascades: every collection scoped to the company
   * goes with it, so a dev-mode deletion behaves like the real one. */
  async delete(id: string): Promise<void> {
    mutate((db) => {
      const templateIds = new Set(
        (db.templates as TemplateSchema[]).filter((t) => t.companyId === id).map((t) => t.id),
      );
      db.companies = (db.companies as Company[]).filter((c) => c.id !== id);
      db.templates = (db.templates as TemplateSchema[]).filter((t) => t.companyId !== id);
      db.brandKits = (db.brandKits as BrandKit[]).filter((k) => k.companyId !== id);
      db.brandAssets = (db.brandAssets as BrandAsset[]).filter((a) => a.companyId !== id);
      db.usageEvents = (db.usageEvents as UsageEventRec[]).filter((e) => e.companyId !== id);
      db.templateLinks = (db.templateLinks as TemplateLinkRec[]).filter(
        (l) => !templateIds.has(l.templateId),
      );
      db.companyCanvasPresets = (db.companyCanvasPresets as CompanyPresetRec[]).filter(
        (p) => p.companyId !== id,
      );
    });
  }
  async isSlugAvailable(slug: string, excludeCompanyId: string): Promise<boolean> {
    return !(readDb().companies as Company[]).some(
      (c) => c.slug === slug && c.id !== excludeCompanyId,
    );
  }
  async hasAnyCompany(): Promise<boolean> {
    return readDb().companies.length > 0;
  }
  // Dimension data lives in SIZE_CATALOG (code); the stored rows only record
  // which catalogue ids this workspace turned off.
  async listCanvasSizes(companyId?: string): Promise<CanvasSize[]> {
    if (!companyId) return SIZE_CATALOG;
    const disabled = this.disabledSizeIds(companyId);
    const filtered = SIZE_CATALOG.filter((s) => !disabled.has(s.id));
    return filtered.length > 0 ? filtered : SIZE_CATALOG;
  }
  async listCanvasSizeSettings(
    companyId: string,
  ): Promise<Array<{ size: CanvasSize; enabled: boolean }>> {
    const disabled = this.disabledSizeIds(companyId);
    return SIZE_CATALOG.map((size) => ({ size, enabled: !disabled.has(size.id) }));
  }
  async setCanvasSizeEnabled(companyId: string, sizeId: string, enabled: boolean): Promise<void> {
    mutate((db) => {
      const rows = db.companyCanvasPresets as CompanyPresetRec[];
      const i = rows.findIndex((r) => r.companyId === companyId && r.presetId === sizeId);
      if (i >= 0) rows[i] = { ...rows[i], enabled };
      else rows.push({ companyId, presetId: sizeId, enabled });
    });
  }
  private disabledSizeIds(companyId: string): Set<string> {
    return new Set(
      (readDb().companyCanvasPresets as CompanyPresetRec[])
        .filter((r) => r.companyId === companyId && !r.enabled)
        .map((r) => r.presetId),
    );
  }
}

export class LocalTemplateStore implements TemplateStore {
  async listPublished(companyId: string): Promise<TemplateSchema[]> {
    return (await this.listAll(companyId)).filter((t) => t.status === "published");
  }
  async listAll(companyId: string): Promise<TemplateSchema[]> {
    return (readDb().templates as TemplateSchema[])
      .filter((t) => t.companyId === companyId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  async get(id: string): Promise<TemplateSchema | null> {
    return (readDb().templates as TemplateSchema[]).find((t) => t.id === id) ?? null;
  }
  async create(input: NewTemplateInput): Promise<TemplateSchema> {
    const now = new Date().toISOString();
    const template: TemplateSchema = { ...input, id: newId(), createdAt: now, updatedAt: now };
    mutate((db) => db.templates.push(template));
    return template;
  }
  async update(id: string, patch: Partial<NewTemplateInput>): Promise<TemplateSchema> {
    return mutate((db) => {
      const templates = db.templates as TemplateSchema[];
      const i = templates.findIndex((t) => t.id === id);
      if (i < 0) throw new Error(`Template ${id} not found`);
      templates[i] = { ...templates[i], ...patch, updatedAt: new Date().toISOString() };
      return templates[i];
    });
  }
  async setStatus(id: string, status: TemplateStatus): Promise<void> {
    await this.update(id, { status });
  }
  async duplicate(id: string, name: string): Promise<TemplateSchema> {
    const source = await this.get(id);
    if (!source) throw new Error(`Template ${id} not found`);
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = source;
    return this.create({
      ...rest,
      name,
      status: "draft",
      // New field ids; fieldKeys stay EXACTLY as-is so caption merge tags
      // keep working. backgroundUrl is copied by reference, not re-uploaded.
      fields: source.fields.map((f) => ({ ...f, id: newId() })),
    });
  }
  async delete(id: string): Promise<void> {
    mutate((db) => {
      db.templates = (db.templates as TemplateSchema[]).filter((t) => t.id !== id);
    });
  }
  async uploadBackground(_companyId: string, file: Blob): Promise<string> {
    return fileToDataUrl(file); // data URLs stand in for Storage URLs in dev
  }
}

export class LocalBrandKitStore implements BrandKitStore {
  async getActive(companyId: string): Promise<BrandKit | null> {
    const kit = (readDb().brandKits as Array<Partial<BrandKit> & BrandKit>).find(
      (k) => k.companyId === companyId,
    );
    if (!kit) return null;
    // Kits saved before the rules engine existed lack the new arrays.
    return { ...kit, typeStyles: kit.typeStyles ?? [], guidelines: kit.guidelines ?? [] };
  }
  async upsert(companyId: string, kit: Omit<BrandKit, "id" | "companyId">): Promise<BrandKit> {
    return mutate((db) => {
      const kits = db.brandKits as BrandKit[];
      const i = kits.findIndex((k) => k.companyId === companyId);
      const next: BrandKit = { ...kit, id: i >= 0 ? kits[i].id : newId(), companyId };
      if (i >= 0) kits[i] = next;
      else kits.push(next);
      return next;
    });
  }
}

export class LocalBrandAssetStore implements BrandAssetStore {
  async list(companyId: string, kind?: BrandAsset["kind"]): Promise<BrandAsset[]> {
    return (readDb().brandAssets as BrandAsset[]).filter(
      (a) => a.companyId === companyId && (!kind || a.kind === kind),
    );
  }
  async upload(
    companyId: string,
    kind: BrandAsset["kind"],
    file: File,
    metadata: BrandAsset["metadata"] = {},
  ): Promise<BrandAsset> {
    const asset: BrandAsset = {
      id: newId(),
      companyId,
      kind,
      name: file.name,
      url: await fileToDataUrl(file),
      metadata,
      createdAt: new Date().toISOString(),
    };
    mutate((db) => db.brandAssets.push(asset));
    return asset;
  }
  async remove(id: string): Promise<void> {
    mutate((db) => {
      db.brandAssets = (db.brandAssets as BrandAsset[]).filter((a) => a.id !== id);
    });
  }
}

export class LocalUsageStore implements UsageStore {
  async record(
    companyId: string,
    templateId: string,
    action: UsageAction,
    userId?: string,
  ): Promise<void> {
    const event: UsageEventRec = {
      id: newId(),
      companyId,
      templateId,
      action,
      userId: userId ?? null,
      actor: "member",
      createdAt: new Date().toISOString(),
    };
    mutate((db) => db.usageEvents.push(event));
  }
  async recordBulk(
    companyId: string,
    templateId: string,
    count: number,
    userId?: string,
  ): Promise<void> {
    if (count <= 0) return;
    const createdAt = new Date().toISOString();
    const events: UsageEventRec[] = Array.from({ length: count }, () => ({
      id: newId(),
      companyId,
      templateId,
      action: "bulk_export",
      userId: userId ?? null,
      actor: "member",
      createdAt,
    }));
    mutate((db) => db.usageEvents.push(...events));
  }
  async getUsageSummary(companyId: string): Promise<UsageSummary> {
    const db = readDb();
    const templates = db.templates as TemplateSchema[];
    const byTemplate = new Map<string, UsageSummaryRow>();
    for (const e of (db.usageEvents as UsageEventRec[]).filter((e) => e.companyId === companyId)) {
      const row = byTemplate.get(e.templateId) ?? {
        templateId: e.templateId,
        templateName: templates.find((t) => t.id === e.templateId)?.name ?? "(deleted template)",
        opens: 0,
        downloads: 0,
        shares: 0,
        bulkExports: 0,
        publicOpens: 0,
        publicDownloads: 0,
        lastUsedAt: null,
      };
      const viaLink = e.actor === "public";
      // Named explicitly — see the note in 0027_share_events.sql.
      if (e.action === "open") {
        row.opens += 1;
        if (viaLink) row.publicOpens += 1;
      } else if (e.action === "download") {
        row.downloads += 1;
        if (viaLink) row.publicDownloads += 1;
      } else if (e.action === "share") {
        row.shares += 1;
      } else if (e.action === "bulk_export") {
        row.bulkExports += 1;
      }
      if (!row.lastUsedAt || e.createdAt > row.lastUsedAt) row.lastUsedAt = e.createdAt;
      byTemplate.set(e.templateId, row);
    }
    const rows = [...byTemplate.values()].sort(
      (a, b) => b.downloads - a.downloads || b.opens - a.opens,
    );
    return { rows, totalDownloads: rows.reduce((n, r) => n + r.downloads, 0) };
  }
  async getDailyActivity(companyId: string, days: number, timeZone?: string) {
    const db = readDb();
    return bucketDailyActivity(
      (db.usageEvents as UsageEventRec[]).filter((e) => e.companyId === companyId),
      days,
      timeZone,
    );
  }
  async getMonthlyUsage(companyId: string, timeZone = "UTC"): Promise<MonthlyUsage> {
    const since = monthStartIso(timeZone);
    return summarizeMonthlyUsage(
      (readDb().usageEvents as UsageEventRec[]).filter(
        (e) => e.companyId === companyId && e.createdAt >= since,
      ),
      timeZone,
    );
  }
  async listEvents(companyId: string) {
    return (readDb().usageEvents as UsageEventRec[])
      .filter((e) => e.companyId === companyId)
      .map((e) => ({
        templateId: e.templateId,
        action: e.action,
        actor: e.actor ?? ("member" as UsageActor),
        userId: e.userId,
        createdAt: e.createdAt,
      }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  /** Joined exactly as the Supabase store joins it, over whatever links the
   * local document store holds. Normally none — this backend cannot issue
   * one — in which case the Insights card simply does not appear. */
  async getPublicLinkUsage(companyId: string): Promise<PublicLinkUsageRow[]> {
    const db = readDb();
    const templates = db.templates as TemplateSchema[];
    const links = (db.templateLinks as TemplateLinkRec[])
      .map((l) => ({
        id: l.id,
        name: l.name,
        templateId: l.templateId,
        templateName: templates.find((t) => t.id === l.templateId)?.name ?? "(deleted template)",
        revokedAt: l.revokedAt ?? null,
        createdAt: l.createdAt,
      }))
      .filter((l) => templates.some((t) => t.id === l.templateId && t.companyId === companyId));
    const events = (db.usageEvents as UsageEventRec[])
      .filter((e) => e.companyId === companyId && e.actor === "public" && e.linkId)
      .map((e) => ({ linkId: e.linkId!, action: e.action, createdAt: e.createdAt }));
    return joinLinkUsage(links, events);
  }
}

/** Dev mode has no real users, so there is no profile to edit and no row to
 * hold notification preferences — the Account section checks isAvailable()
 * and says so instead of offering controls that cannot persist. */
export class LocalAccountStore implements AccountStore {
  private static readonly REASON =
    "Account settings need the Supabase backend with auth enabled — this dev backend has no real accounts.";
  isAvailable(): boolean {
    return false;
  }
  async getDisplayName(): Promise<null> {
    return null;
  }
  async setDisplayName(): Promise<never> {
    throw new Error(LocalAccountStore.REASON);
  }
  async getNotificationPrefs() {
    return { inviteAccepted: true, weeklyDigest: true, linkExpiring: true };
  }
  async setNotificationPrefs(): Promise<never> {
    throw new Error(LocalAccountStore.REASON);
  }
}

/** Dev mode has no real users — People management needs the Supabase backend. */
export class LocalPeopleStore {
  async list(): Promise<never[]> {
    return [];
  }
  async invite(): Promise<void> {
    throw new Error("Inviting people requires the Supabase backend with auth enabled.");
  }
  async setRole(): Promise<void> {
    throw new Error("Requires the Supabase backend.");
  }
  async remove(): Promise<void> {
    throw new Error("Requires the Supabase backend.");
  }
}

/** Dev mode has no Edge Functions, so Figma import is unavailable — the
 * Template Builder detects this and shows only the manual PNG path. */
/** Public links need a server: a token has to be minted and hashed where the
 * browser cannot reach, and the read path has to bypass RLS under the
 * service role. Neither exists on the localStorage backend, so this says so
 * rather than pretending. The admin UI checks isAvailable() and explains
 * instead of offering a button that cannot work. */
export class LocalPublicLinkStore implements PublicLinkStore {
  private static readonly REASON = "Public links require the Supabase backend (see .env.example).";
  isAvailable(): boolean {
    return false;
  }
  async list(): Promise<never[]> {
    return [];
  }
  /** READ-ONLY, like Insights' per-link card: this backend cannot issue a
   * link, but a seeded collection still renders in the Sharing inventory so
   * the surface is demoable. The join is the shared, tested predicate. */
  async listAll(companyId: string): Promise<CompanyTemplateLink[]> {
    const db = readDb();
    const templates = (db.templates as TemplateSchema[]).map((t) => ({
      id: t.id,
      name: t.name,
      companyId: t.companyId,
    }));
    const links = (db.templateLinks as TemplateLinkRec[]).map((l) => ({
      id: l.id,
      name: l.name,
      templateId: l.templateId,
      // The dev collection stores only the fields Insights needs; the rest
      // take the column defaults from 0026.
      allowUploads: true,
      expiresAt: null,
      useCap: null,
      useCount: 0,
      revokedAt: l.revokedAt ?? null,
      createdAt: l.createdAt,
      lastUsedAt: null,
    }));
    return joinCompanyLinks(links, templates, companyId);
  }
  async create(): Promise<never> {
    throw new Error(LocalPublicLinkStore.REASON);
  }
  async update(): Promise<never> {
    throw new Error(LocalPublicLinkStore.REASON);
  }
  async revoke(): Promise<never> {
    throw new Error(LocalPublicLinkStore.REASON);
  }
  async regenerate(): Promise<never> {
    throw new Error(LocalPublicLinkStore.REASON);
  }
}

/** Generate needs Edge Functions and a model key, neither of which the dev
 * backend has — so it says so, and the surface shows an honest disabled
 * state instead of a button that cannot work (the designImport precedent). */
export class LocalGenerateProvider implements GenerateProvider {
  isConfigured(): boolean {
    return false;
  }
  async generate(): Promise<never> {
    throw new Error(
      "Generate requires the Supabase backend and an Anthropic API key (see .env.example).",
    );
  }
  async repair(): Promise<never> {
    throw new Error(
      "Generate requires the Supabase backend and an Anthropic API key (see .env.example).",
    );
  }
}

export class LocalDesignImportProvider implements DesignImportProvider {
  readonly providers: import("../../types").DesignSourceKind[] = [];
  isConfigured(): boolean {
    return false;
  }
  async isConnected(): Promise<boolean> {
    return false;
  }
  async connect(): Promise<void> {
    throw new Error("Figma integration requires the Supabase backend (see .env.example).");
  }
  async importFromUrl(): Promise<DesignImportResult> {
    throw new Error("Figma integration requires the Supabase backend (see .env.example).");
  }
  async importElementsFromUrl(): Promise<never> {
    throw new Error("Figma integration requires the Supabase backend (see .env.example).");
  }
  async importStylesFromUrl(): Promise<never> {
    throw new Error("Figma integration requires the Supabase backend (see .env.example).");
  }
  async renderLayers(): Promise<never> {
    throw new Error("Figma integration requires the Supabase backend (see .env.example).");
  }
  async canvaStatus(): Promise<{ enabled: boolean; connected: boolean }> {
    return { enabled: false, connected: false };
  }
  /** Nothing to report: the Integrations section checks isConfigured() first
   * and explains the dev backend instead of rendering these rows. */
  async connectionInfo(): Promise<never[]> {
    return [];
  }
  async disconnect(): Promise<never> {
    throw new Error("Integrations require the Supabase backend (see .env.example).");
  }
  async canvaConnectStart(): Promise<never> {
    throw new Error("Canva integration requires the Supabase backend.");
  }
  async canvaConnectCallback(): Promise<never> {
    throw new Error("Canva integration requires the Supabase backend.");
  }
  /** Deterministic demo stub — never calls Anthropic. Two plausible fields so
   * the builder's auto-build path is demoable with no Supabase and no key. */
  async autoBuild(
    _companyId: string,
    source: import("../../types").DesignSource,
    _hint?: string,
  ): Promise<import("../../types").AutoBuildResult> {
    if (source.kind !== "image") {
      throw new Error(
        "Auto-build from a link requires the Supabase backend; upload an image instead.",
      );
    }
    const w = source.canvasWidth;
    const h = source.canvasHeight;
    const fields: import("../../types").TemplateField[] = [
      {
        id: newId(),
        label: "Headline",
        fieldKey: "headline",
        type: "text",
        x: Math.round(w * 0.08),
        y: Math.round(h * 0.12),
        width: Math.round(w * 0.84),
        height: Math.round(h * 0.12),
        placeholder: "Big announcement",
        required: true,
        maxLength: 60,
        textSizing: "shrink",
      },
      {
        id: newId(),
        label: "Photo",
        fieldKey: "photo",
        type: "image",
        x: Math.round(w * 0.3),
        y: Math.round(h * 0.35),
        width: Math.round(w * 0.4),
        height: Math.round(h * 0.4),
        objectFit: "cover",
      },
    ];
    return {
      sourceKind: "image",
      backgroundUrl: source.backgroundUrl,
      canvasWidth: w,
      canvasHeight: h,
      fields,
      template: {
        name: "Auto-built template",
        description: "Demo proposal from the local stub.",
        category: "General",
        tags: ["demo"],
        captionTemplate: "{headline} — see the photo!",
      },
      rationale: [
        { fieldKey: "headline", why: "The main line changes on every post." },
        { fieldKey: "photo", why: "A photo slot members fill per post." },
      ],
      warnings: ["Local demo stub — no model was called."],
      meta: {
        model: "local-stub",
        sourceKind: "image",
        generatedAt: new Date(0).toISOString(),
        elementCount: 2,
        editableCount: 2,
      },
    };
  }
}
