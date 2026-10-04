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
  { key: "usage", label: "Usage & plan", adminOnly: true },
  { key: "sharing", label: "Sharing", adminOnly: true },
  { key: "account", label: "Account", adminOnly: false },
  { key: "advanced", label: "Advanced", adminOnly: true },
];

/** The sections a role sees, in rail order. Account is the one section every
 * member reaches. */
export function settingsSectionsFor(role: "admin" | "member"): SettingsSectionDef[] {
  return SETTINGS_SECTION_DEFS.filter((s) => role === "admin" || !s.adminOnly);
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
  role: "admin" | "member",
): SettingsSection {
  const visible = settingsSectionsFor(role);
  return visible.some((s) => s.key === requested) ? requested! : settingsFallback(role);
}
