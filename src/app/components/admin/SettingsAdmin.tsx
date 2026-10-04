import React, { useEffect } from "react";
import {
  Building,
  CreditCard,
  Link,
  Plug,
  Settings2,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useRouter, type SettingsSection } from "../../router";
import { Page, PageHeader } from "../layout/Page";
import { SettingsRailItem } from "../primitives";
import { AccountSection } from "./settings/AccountSection";
import { AdvancedSection } from "./settings/AdvancedSection";
import { IntegrationsSection } from "./settings/IntegrationsSection";
import { SharingSection } from "./settings/SharingSection";
import { PeopleSection } from "./settings/PeopleSection";
import { resolveSettingsSection, settingsSectionsFor } from "./settings/settingsSections";
import { UsageSection } from "./settings/UsageSection";
import { WorkspaceSection } from "./settings/WorkspaceSection";

/** The rail's icons, as the Settings frames draw them (8:678). */
const ICONS: Record<SettingsSection, LucideIcon> = {
  workspace: Building,
  people: Users,
  integrations: Plug,
  usage: CreditCard,
  sharing: Link,
  account: User,
  advanced: Settings2,
};

const RENDER: Record<SettingsSection, () => React.ReactNode> = {
  workspace: () => <WorkspaceSection />,
  people: () => <PeopleSection />,
  integrations: () => <IntegrationsSection />,
  usage: () => <UsageSection />,
  sharing: () => <SharingSection />,
  account: () => <AccountSection />,
  advanced: () => <AdvancedSection />,
};

/** Settings & Admin: a two-column settings surface — persistent section rail
 * left, one section right, each section URL-addressable
 * (/settings/integrations is a shareable link). Role gating happens HERE,
 * not at the route: a member lands on Account with the admin sections
 * hidden, never shown-and-disabled. */
export function SettingsAdmin({ section }: { section?: SettingsSection }) {
  const { role, companies, isDevAuth } = useAuth();
  const { navigate } = useRouter();

  const viewer = { role, canSwitchWorkspace: companies.length > 1 || isDevAuth };
  const visible = settingsSectionsFor(viewer);
  // Unknown or absent section → workspace for admins; anything a member
  // cannot see → account.
  const active = visible.find((s) => s.key === resolveSettingsSection(section, viewer))!;

  // Keep the URL honest when the request was corrected (a member deep-linked
  // to an admin section, or no section was given) — without a history entry.
  useEffect(() => {
    if (section !== active.key) {
      navigate({ name: "settings", section: active.key }, { replace: true });
    }
  }, [section, active.key, navigate]);

  return (
    <Page>
      <PageHeader title="Settings & Admin" />
      <div className="sp-shell-settings">
        <nav className="sp-shell-settings__rail" aria-label="Settings sections">
          {visible.map(({ key, label }) => (
            <SettingsRailItem
              key={key}
              icon={ICONS[key]}
              selected={key === active.key}
              onClick={() => navigate({ name: "settings", section: key })}
            >
              {label}
            </SettingsRailItem>
          ))}
        </nav>
        <div className="sp-shell-settings__section">{RENDER[active.key]()}</div>
      </div>
    </Page>
  );
}
