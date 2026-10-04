import type { SettingsSection } from "../../../router";

export interface SettingsSectionDef {
  key: SettingsSection;
  label: string;
  adminOnly: boolean;
}

/** The Settings rail, in the frames' order (Figma Settings 8:678). */
export const SETTINGS_SECTION_DEFS: readonly SettingsSectionDef[] = [
  { key: "workspace", label: "Workspace", adminOnly: true },
  { key: "people", label: "People", adminOnly: true },
  { key: "integrations", label: "Integrations", adminOnly: true },
  { key: "usage", label: "Plan & usage", adminOnly: true },
  { key: "sharing", label: "Sharing", adminOnly: true },
  { key: "account", label: "Account", adminOnly: false },
  { key: "advanced", label: "Advanced", adminOnly: true },
];

/** Who is looking: their role, and whether they can switch workspaces
 * (more than one workspace, or the local backend), which is when today's
 * sidebar gave a member its switcher. */
export interface SettingsViewer {
  role: "admin" | "member";
  canSwitchWorkspace: boolean;
}

/** The sections a viewer sees, in rail order. Account is the one section
 * every member reaches; a member who can switch workspaces also gets
 * Workspace, which then holds only the Workspaces card (PHASE-3.md §9). */
export function settingsSectionsFor(viewer: SettingsViewer): SettingsSectionDef[] {
  return SETTINGS_SECTION_DEFS.filter(
    (s) =>
      viewer.role === "admin" ||
      !s.adminOnly ||
      (s.key === "workspace" && viewer.canSwitchWorkspace),
  );
}

/** Where Settings lands when no section (or one the role cannot see) is
 * asked for. */
export const settingsFallback = (role: "admin" | "member"): SettingsSection =>
  role === "admin" ? "workspace" : "account";

/** The section Settings shows for a request: the one asked for when the
 * role can see it, else the role's fallback. SettingsAdmin rewrites the
 * address to match. */
export function resolveSettingsSection(
  requested: SettingsSection | undefined,
  viewer: SettingsViewer,
): SettingsSection {
  const visible = settingsSectionsFor(viewer);
  return visible.some((s) => s.key === requested) ? requested! : settingsFallback(viewer.role);
}
