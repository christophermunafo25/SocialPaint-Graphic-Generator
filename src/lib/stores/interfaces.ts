// Data-layer contracts. Components import ONLY these interfaces (via the
// factory in ./index.ts) — nothing outside src/lib touches a backend client.

import type {
  BrandAsset,
  BrandKit,
  CanvasPreset,
  Company,
  DailyActivityPoint,
  DesignImportResult,
  NewTemplateInput,
  TemplateSchema,
  TemplateStatus,
  UsageAction,
  UsageSummary,
} from "../types";

export interface CompanyStore {
  list(): Promise<Company[]>; // dev switcher needs the full list
  get(id: string): Promise<Company | null>;
  create(input: { name: string; slug: string }): Promise<Company>;
  hasAnyCompany(): Promise<boolean>; // first-run / onboarding routing
  listCanvasPresets(): Promise<CanvasPreset[]>;
}

export interface TemplateStore {
  listPublished(companyId: string): Promise<TemplateSchema[]>; // member portal
  listAll(companyId: string): Promise<TemplateSchema[]>; // admin (drafts too)
  get(id: string): Promise<TemplateSchema | null>;
  create(input: NewTemplateInput): Promise<TemplateSchema>;
  /** Fields are replaced wholesale (delete + insert) on each builder save. */
  update(id: string, patch: Partial<NewTemplateInput>): Promise<TemplateSchema>;
  setStatus(id: string, status: TemplateStatus): Promise<void>;
  /** Deep copy: new template row, new field rows, same fieldKeys so the
   *  captionTemplate stays valid. Always lands as a draft. */
  duplicate(id: string, name: string): Promise<TemplateSchema>;
  delete(id: string): Promise<void>;
  uploadBackground(companyId: string, file: Blob, name: string): Promise<string>; // → public URL
}

export interface BrandKitStore {
  getActive(companyId: string): Promise<BrandKit | null>; // null → neutral default theme
  upsert(companyId: string, kit: Omit<BrandKit, "id" | "companyId">): Promise<BrandKit>;
}

export interface BrandAssetStore {
  list(companyId: string, kind?: BrandAsset["kind"]): Promise<BrandAsset[]>;
  upload(
    companyId: string,
    kind: BrandAsset["kind"],
    file: File,
    metadata?: BrandAsset["metadata"],
  ): Promise<BrandAsset>;
  remove(id: string): Promise<void>;
}

export interface Member {
  userId: string;
  email: string;
  name?: string;
  role: import("../types").Role;
}

/** Team management under real auth (invites go through the invite-member
 * Edge Function so the service role never reaches the client). */
export interface PeopleStore {
  list(companyId: string): Promise<Member[]>;
  invite(companyId: string, email: string, role: import("../types").Role): Promise<void>;
  setRole(companyId: string, userId: string, role: import("../types").Role): Promise<void>;
  remove(companyId: string, userId: string): Promise<void>;
}

export interface UsageStore {
  /** Fire-and-forget from SchemaRenderer; failures must never break the UI. */
  record(companyId: string, templateId: string, action: UsageAction, userId?: string): Promise<void>;
  getUsageSummary(companyId: string): Promise<UsageSummary>;
  /** Zero-filled day buckets for the Insights trend chart. */
  getDailyActivity(companyId: string, days: number): Promise<DailyActivityPoint[]>;
}

export interface DesignImportProvider {
  /** Source kinds this provider can import from. */
  readonly providers: import("../types").DesignSourceKind[];
  isConfigured(): boolean; // backend reachable at all (Edge Functions deployed)
  isConnected(companyId: string): Promise<boolean>;
  connect(companyId: string, credential: { kind: "oauth-code" | "pat"; value: string }): Promise<void>;
  importFromUrl(companyId: string, url: string): Promise<DesignImportResult>;
  /** Design-system import: pull the color + text styles of a Figma FILE into
   * palette entries + brand type styles (Feature 4 → design-system import). */
  importStylesFromUrl(companyId: string, url: string): Promise<StyleImportResult>;
  /** Re-render a frame's layers EXCLUDING the given node ids so the client
   * can recompose a background with the field elements lifted off. */
  renderLayers(
    companyId: string,
    url: string,
    excludeNodeIds: string[],
  ): Promise<import("../types").LayerRenderResult>;
  /** Auto-build: Claude turns a design into a complete template proposal —
   * fields with Fixed marks, labels, guardrails, brand bindings, metadata,
   * and a caption. The client applies it to the draft; nothing is written
   * server-side. */
  autoBuild(
    companyId: string,
    source: import("../types").DesignSource,
    hint?: string,
  ): Promise<import("../types").AutoBuildResult>;
  /** Canva connection lifecycle (flagged server-side; enabled=false hides the
   * tab). The PKCE state and verifier never reach the browser — start returns
   * only the authorize URL, and the callback echoes code+state back. */
  canvaStatus(companyId: string): Promise<{ enabled: boolean; connected: boolean }>;
  canvaConnectStart(companyId: string, redirectUri: string): Promise<{ authorizeUrl: string }>;
  canvaConnectCallback(
    companyId: string,
    code: string,
    state: string,
    redirectUri: string,
  ): Promise<void>;
}

export interface StyleImportResult {
  colors: import("../types").BrandColor[];
  typeStyles: import("../types").BrandTypeStyle[];
}

/** Swappable hook for the Template Builder's "Suggest fields" button.
 * v1 ships a stub; a vision-model implementation can drop in later. */
export type DetectFields = (imageUrl: string) => Promise<import("../types").TemplateField[]>;

export interface Stores {
  companies: CompanyStore;
  templates: TemplateStore;
  brandKits: BrandKitStore;
  brandAssets: BrandAssetStore;
  usage: UsageStore;
  people: PeopleStore;
  designImport: DesignImportProvider;
  /** "supabase" or "local" — surfaced in the dev switcher so it's obvious
   * which backend is active. */
  backend: "supabase" | "local";
}
