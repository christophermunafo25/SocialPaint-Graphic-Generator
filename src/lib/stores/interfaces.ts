// Data-layer contracts. Components import ONLY these interfaces (via the
// factory in ./index.ts) — nothing outside src/lib touches a backend client.

import type {
  BrandAsset,
  BrandKit,
  CanvasPreset,
  Company,
  CompanyPatch,
  CompanyTemplateLink,
  DailyActivityPoint,
  DesignImportResult,
  GenerateInput,
  GenerateRepairInput,
  GenerateRepairResult,
  GenerateResult,
  IntegrationConnectionInfo,
  MonthlyUsage,
  NewTemplateInput,
  NotificationPrefs,
  PublicLinkUsageRow,
  TemplateLink,
  TemplateLinkPatch,
  TemplateLinkWithToken,
  TemplateSchema,
  TemplateStatus,
  UsageAction,
  UsageSummary,
} from "../types";

export interface CompanyStore {
  list(): Promise<Company[]>; // dev switcher needs the full list
  get(id: string): Promise<Company | null>;
  create(input: { name: string; slug: string }): Promise<Company>;
  /** Settings → Workspace. Admin-only server-side (RLS admin_update_companies
   * under real auth), same shape of check invite-member makes. */
  update(id: string, patch: CompanyPatch): Promise<Company>;
  /** Settings → Advanced. Removes every row for the company (the schema's
   * cascades do the walking) via the delete-company Edge Function under real
   * auth. The caller signs the actor out afterwards. */
  delete(id: string): Promise<void>;
  /** Live availability for the slug editor. RLS hides other tenants'
   * companies, so this goes through the slug_available RPC rather than a
   * select. `excludeCompanyId` is the company being renamed — its own
   * current slug is always available to itself. */
  isSlugAvailable(slug: string, excludeCompanyId: string): Promise<boolean>;
  hasAnyCompany(): Promise<boolean>; // first-run / onboarding routing
  /** Globally enabled presets, minus the ones `companyId` has turned off in
   * Settings. Omitting companyId returns the global list (onboarding runs
   * before a company exists). Never returns empty when the global list is
   * not: a workspace that somehow disabled everything falls back to all. */
  listCanvasPresets(companyId?: string): Promise<CanvasPreset[]>;
  /** Settings → Workspace: every globally enabled preset with this
   * company's on/off state. */
  listCanvasPresetSettings(
    companyId: string,
  ): Promise<Array<{ preset: CanvasPreset; enabled: boolean }>>;
  setCanvasPresetEnabled(companyId: string, presetId: string, enabled: boolean): Promise<void>;
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
  uploadBackground(companyId: string, file: Blob, name: string): Promise<string>; // → storage reference (storageRef.ts) or data URL in local mode
}

/** Public share links for a published template.
 *
 * Every method here goes through the template-links Edge Function rather
 * than a table write: tokens are minted server-side and stored hashed, and
 * every action lands in the link audit trail. A client that could write this
 * table directly would be a client that decides what a token is. */
export interface PublicLinkStore {
  /** True when this backend can issue links at all. The localStorage dev
   * backend has no Edge Functions and no hashing, so it says false and the
   * admin UI explains rather than offering a button that cannot work. */
  isAvailable(): boolean;
  list(companyId: string, templateId: string): Promise<TemplateLink[]>;
  /** Returns the plaintext token, which is visible exactly once — here. */
  create(
    companyId: string,
    templateId: string,
    input: TemplateLinkPatch,
  ): Promise<TemplateLinkWithToken>;
  update(companyId: string, linkId: string, patch: TemplateLinkPatch): Promise<TemplateLink>;
  /** Immediate: the next request through this link fails. */
  revoke(companyId: string, linkId: string): Promise<TemplateLink>;
  /** New token, old token dead, in one action. */
  regenerate(companyId: string, linkId: string): Promise<TemplateLinkWithToken>;
  /** Every link across the company's templates, newest first — the Sharing
   * inventory. Includes revoked and expired links; the UI filters. */
  listAll(companyId: string): Promise<CompanyTemplateLink[]>;
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
  record(
    companyId: string,
    templateId: string,
    action: UsageAction,
    userId?: string,
  ): Promise<void>;
  getUsageSummary(companyId: string): Promise<UsageSummary>;
  /** Zero-filled day buckets for the Insights trend chart. `timeZone` is the
   * workspace's IANA zone — day boundaries follow it, so every admin reads
   * the same chart (defaults to UTC, matching companies.timezone). */
  getDailyActivity(
    companyId: string,
    days: number,
    timeZone?: string,
  ): Promise<DailyActivityPoint[]>;
  /** Current-calendar-month totals for Settings → Usage & plan. The month
   * boundary follows `timeZone` too. */
  getMonthlyUsage(companyId: string, timeZone?: string): Promise<MonthlyUsage>;
  /** Per-link traffic, for an admin running several links to one template.
   * Links with no traffic are included — an untouched link is a finding. */
  getPublicLinkUsage(companyId: string): Promise<PublicLinkUsageRow[]>;
  /** Every raw event, for the workspace data export (admin-read under RLS). */
  listEvents(companyId: string): Promise<
    Array<{
      templateId: string;
      action: UsageAction;
      actor: import("../types").UsageActor;
      userId: string | null;
      createdAt: string;
    }>
  >;
}

export interface DesignImportProvider {
  /** Source kinds this provider can import from. */
  readonly providers: import("../types").DesignSourceKind[];
  isConfigured(): boolean; // backend reachable at all (Edge Functions deployed)
  isConnected(companyId: string): Promise<boolean>;
  connect(
    companyId: string,
    credential: { kind: "oauth-code" | "pat"; value: string },
  ): Promise<void>;
  importFromUrl(companyId: string, url: string): Promise<DesignImportResult>;
  /** A single Figma layer (pasted as a link) as live elements — no
   * background replacement, no canvas change. */
  importElementsFromUrl(
    companyId: string,
    url: string,
  ): Promise<import("../types").ElementImportResult>;
  /** Design-system import: pull the color + text styles of a Figma FILE into
   * palette entries + brand type styles (Feature 4 → design-system import). */
  importStylesFromUrl(companyId: string, url: string): Promise<StyleImportResult>;
  /** Re-render a frame's layers EXCLUDING the given node ids so the client
   * can recompose a background with the field elements lifted off. `tree`
   * is the (pruned) node tree the import already fetched — supplying it
   * keeps both walks on one consistent snapshot and skips a Figma fetch. */
  renderLayers(
    companyId: string,
    url: string,
    excludeNodeIds: string[],
    tree?: unknown,
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
  /** Settings → Integrations: connection state and provenance for every
   * provider. Never the token — status rows show who connected and when. */
  connectionInfo(companyId: string): Promise<IntegrationConnectionInfo[]>;
  /** Severs a provider connection (admin-verified server-side). Imports and
   * auto-build stop working until someone reconnects. */
  disconnect(companyId: string, provider: "figma" | "canva"): Promise<void>;
}

/** Generate: a member's brief in, filled-template proposals out, through the
 * template-generate Edge Function. The function reads the published library
 * and writes nothing — the client renders the proposals and seeds the
 * existing fill page with the chosen one. */
export interface GenerateProvider {
  /** Backend reachable at all. The localStorage dev backend has no Edge
   * Functions and no model key, so it says false and the surface explains
   * rather than offering a button that cannot work. */
  isConfigured(): boolean;
  generate(companyId: string, input: GenerateInput): Promise<GenerateResult>;
  /** One repair round for one proposal: the measurement pass names the
   * overflowing fields and their measured character budgets; the server
   * rewrites only those values. */
  repair(companyId: string, input: GenerateRepairInput): Promise<GenerateRepairResult>;
}

export interface StyleImportResult {
  colors: import("../types").BrandColor[];
  typeStyles: import("../types").BrandTypeStyle[];
}

/** Swappable hook for the Template Builder's "Suggest fields" button.
 * v1 ships a stub; a vision-model implementation can drop in later. */
export type DetectFields = (imageUrl: string) => Promise<import("../types").TemplateField[]>;

/** The signed-in user's own profile and preferences (Settings → Account).
 * Real accounts only: the localStorage dev backend has no users, says so via
 * isAvailable(), and the Account section explains instead of offering
 * controls that cannot work. */
export interface AccountStore {
  isAvailable(): boolean;
  getDisplayName(userId: string): Promise<string | null>;
  setDisplayName(userId: string, name: string): Promise<void>;
  /** Absent row resolves to all-on defaults — flipping delivery on later
   * honors what people chose rather than starting everyone silent. */
  getNotificationPrefs(userId: string): Promise<NotificationPrefs>;
  setNotificationPrefs(userId: string, prefs: NotificationPrefs): Promise<void>;
}

export interface Stores {
  companies: CompanyStore;
  account: AccountStore;
  templates: TemplateStore;
  brandKits: BrandKitStore;
  brandAssets: BrandAssetStore;
  usage: UsageStore;
  people: PeopleStore;
  publicLinks: PublicLinkStore;
  designImport: DesignImportProvider;
  generate: GenerateProvider;
  /** "supabase" or "local" — surfaced in the dev switcher so it's obvious
   * which backend is active. */
  backend: "supabase" | "local";
}
