import type {
  BrandAsset,
  BrandKit,
  Company,
  TemplateSchema,
  UsageAction,
  UsageActor,
} from "../types";
import type { Member } from "../stores/interfaces";

/** One raw usage event, as exported. */
export interface ExportedUsageEvent {
  templateId: string;
  action: UsageAction;
  actor: UsageActor;
  userId: string | null;
  createdAt: string;
}

/** The file "Export workspace data" produces. Assembled client-side from
 * the existing stores — no Edge Function, no server-side snapshot. */
export interface WorkspaceExport {
  format: "socialpaint-workspace-export";
  version: 1;
  exportedAt: string;
  /** Stated in the file itself, not just in the UI: binary assets are
   * referenced, not embedded. */
  note: string;
  company: Pick<Company, "id" | "name" | "slug" | "timezone" | "createdAt">;
  brandKit: BrandKit | null;
  /** url is the storage reference — the binary itself is NOT in this file. */
  brandAssets: Array<Pick<BrandAsset, "id" | "kind" | "name" | "url" | "metadata" | "createdAt">>;
  templates: TemplateSchema[];
  members: Member[];
  usageEvents: ExportedUsageEvent[];
}

export const EXPORT_BINARIES_NOTE =
  "Backgrounds, fonts, and logos are referenced by their storage path; the binary files themselves are not included in this export.";

export function buildWorkspaceExport(input: {
  company: Company;
  brandKit: BrandKit | null;
  brandAssets: BrandAsset[];
  templates: TemplateSchema[];
  members: Member[];
  usageEvents: ExportedUsageEvent[];
}): WorkspaceExport {
  const { company } = input;
  return {
    format: "socialpaint-workspace-export",
    version: 1,
    exportedAt: new Date().toISOString(),
    note: EXPORT_BINARIES_NOTE,
    company: {
      id: company.id,
      name: company.name,
      slug: company.slug,
      timezone: company.timezone,
      createdAt: company.createdAt,
    },
    brandKit: input.brandKit,
    brandAssets: input.brandAssets.map((a) => ({
      id: a.id,
      kind: a.kind,
      name: a.name,
      url: a.url,
      metadata: a.metadata,
      createdAt: a.createdAt,
    })),
    templates: input.templates,
    members: input.members,
    usageEvents: input.usageEvents,
  };
}
