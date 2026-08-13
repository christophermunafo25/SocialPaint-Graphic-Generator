import type {
  BrandAsset,
  BrandKit,
  CanvasPreset,
  Company,
  DesignImportResult,
  NewTemplateInput,
  TemplateSchema,
  TemplateStatus,
  UsageAction,
  UsageSummary,
  UsageSummaryRow,
} from "../../types";
import type {
  BrandAssetStore,
  BrandKitStore,
  CompanyStore,
  DesignImportProvider,
  TemplateStore,
  UsageStore,
} from "../interfaces";
import { bucketDailyActivity } from "../dailyActivity";
import { fileToDataUrl, mutate, newId, readDb } from "./db";

// Mirrors supabase/seed.sql — v1 enables only the square preset.
const PRESETS: CanvasPreset[] = [
  { id: "square-1440", label: "Square (1440×1440)", width: 1440, height: 1440, enabled: true },
];

interface UsageEventRec {
  id: string;
  companyId: string;
  templateId: string;
  action: UsageAction;
  userId: string | null;
  createdAt: string;
}

export class LocalCompanyStore implements CompanyStore {
  async list(): Promise<Company[]> {
    return (readDb().companies as Company[]).slice().sort((a, b) => a.name.localeCompare(b.name));
  }
  async get(id: string): Promise<Company | null> {
    return (readDb().companies as Company[]).find((c) => c.id === id) ?? null;
  }
  async create(input: { name: string; slug: string }): Promise<Company> {
    const company: Company = { id: newId(), ...input, createdAt: new Date().toISOString() };
    mutate((db) => db.companies.push(company));
    return company;
  }
  async hasAnyCompany(): Promise<boolean> {
    return readDb().companies.length > 0;
  }
  async listCanvasPresets(): Promise<CanvasPreset[]> {
    return PRESETS.filter((p) => p.enabled);
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
      createdAt: new Date().toISOString(),
    };
    mutate((db) => db.usageEvents.push(event));
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
        lastUsedAt: null,
      };
      if (e.action === "open") row.opens += 1;
      else row.downloads += 1;
      if (!row.lastUsedAt || e.createdAt > row.lastUsedAt) row.lastUsedAt = e.createdAt;
      byTemplate.set(e.templateId, row);
    }
    const rows = [...byTemplate.values()].sort(
      (a, b) => b.downloads - a.downloads || b.opens - a.opens,
    );
    return { rows, totalDownloads: rows.reduce((n, r) => n + r.downloads, 0) };
  }
  async getDailyActivity(companyId: string, days: number) {
    const db = readDb();
    return bucketDailyActivity(
      (db.usageEvents as UsageEventRec[]).filter((e) => e.companyId === companyId),
      days,
    );
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
