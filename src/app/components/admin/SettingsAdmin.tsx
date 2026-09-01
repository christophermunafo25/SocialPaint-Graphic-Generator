import React, { useEffect } from "react";
import {
  Building2,
  Gauge,
  Link2,
  Plug,
  Settings2,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useRouter, type SettingsSection } from "../../router";
import { Page, PageHeader } from "../layout/Page";
import { AccountSection } from "./settings/AccountSection";
import { AdvancedSection } from "./settings/AdvancedSection";
import { IntegrationsSection } from "./settings/IntegrationsSection";
import { SharingSection } from "./settings/SharingSection";
import { TeamSection } from "./settings/TeamSection";
import { UsageSection } from "./settings/UsageSection";
import { WorkspaceSection } from "./settings/WorkspaceSection";

interface SectionDef {
  key: SettingsSection;
  label: string;
  Icon: LucideIcon;
  adminOnly: boolean;
  render(): React.ReactNode;
}

/** Rail order = the questions admins actually ask, safety first. Account is
 * the one section members can reach. */
const SECTIONS: SectionDef[] = [
  {
    key: "workspace",
    label: "Workspace",
    Icon: Building2,
    adminOnly: true,
    render: () => <WorkspaceSection />,
  },
  { key: "team", label: "Team", Icon: Users, adminOnly: true, render: () => <TeamSection /> },
  {
    key: "integrations",
    label: "Integrations",
    Icon: Plug,
    adminOnly: true,
    render: () => <IntegrationsSection />,
  },
  {
    key: "usage",
    label: "Usage & plan",
    Icon: Gauge,
    adminOnly: true,
    render: () => <UsageSection />,
  },
  {
    key: "sharing",
    label: "Sharing",
    Icon: Link2,
    adminOnly: true,
    render: () => <SharingSection />,
  },
  {
    key: "account",
    label: "Account",
    Icon: UserRound,
    adminOnly: false,
    render: () => <AccountSection />,
  },
  {
    key: "advanced",
    label: "Advanced",
    Icon: Settings2,
    adminOnly: true,
    render: () => <AdvancedSection />,
  },
];

/** Settings & Admin: a two-column settings surface — persistent section rail
 * left, one section right, each section URL-addressable
 * (/settings/integrations is a shareable link). Role gating happens HERE,
 * not at the route: a member lands on Account with the admin sections
 * hidden, never shown-and-disabled. */
export function SettingsAdmin({ section }: { section?: SettingsSection }) {
  const { company, role } = useAuth();
  const { navigate } = useRouter();

  const isAdmin = role === "admin";
  const visible = SECTIONS.filter((s) => isAdmin || !s.adminOnly);
  // Unknown or absent section → workspace for admins; anything a member
  // cannot see → account.
  const fallback: SettingsSection = isAdmin ? "workspace" : "account";
  const active = visible.find((s) => s.key === section) ?? visible.find((s) => s.key === fallback)!;

  // Keep the URL honest when the request was corrected (a member deep-linked
  // to an admin section, or no section was given) — without a history entry.
  useEffect(() => {
    if (section !== active.key) {
      navigate({ name: "settings", section: active.key }, { replace: true });
    }
  }, [section, active.key, navigate]);

  return (
    <Page wide>
      <PageHeader
        eyebrow={company?.name}
        title="Settings & Admin"
        description={
          isAdmin
            ? "Workspace facts, integrations, sharing, usage, and the ways out."
            : "Your account: appearance and sign out."
        }
      />
      <div className="sp-settings-layout">
        <nav className="sp-settings-rail" aria-label="Settings sections">
          {visible.map(({ key, label, Icon }) => (
            <button
              key={key}
              data-active={key === active.key}
              aria-current={key === active.key ? "page" : undefined}
              onClick={() => navigate({ name: "settings", section: key })}
            >
              <Icon style={{ width: 16, height: 16, flexShrink: 0 }} />
              {label}
            </button>
          ))}
        </nav>
        <div className="min-w-0">{active.render()}</div>
      </div>
    </Page>
  );
}
