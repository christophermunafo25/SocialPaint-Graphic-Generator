import React from "react";
import { Plus } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useRouter } from "../../../router";
import { Avatar, Button, SettingsCard, Status } from "../../primitives";

/** Two letters for a workspace's tile: the first letters of its first two
 * words, or its first two letters. */
export function workspaceInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? "").slice(0, 2);
  return letters.toUpperCase();
}

const ROLE_LABEL = { admin: "Admin", member: "Member" } as const;

/** Settings › Workspace, Workspaces (Figma 13:14698): every workspace the
 * person belongs to, the current one marked, the others one Switch away,
 * and Add workspace, which opens the Create company flow. The meta line is
 * the person's role there alone: the count waits for Phase 7, and none is
 * ever made up. */
export function WorkspacesCard() {
  const { company, companies, roleFor, setCompany } = useAuth();
  const { navigate } = useRouter();
  return (
    <SettingsCard
      title="Workspaces"
      action={
        <Button kind="neutral" icon={Plus} onClick={() => navigate({ name: "onboarding" })}>
          Add workspace
        </Button>
      }
    >
      <ul className="sp-workspaces">
        {companies.map((c) => {
          const role = roleFor(c.id);
          const current = c.id === company?.id;
          return (
            <li key={c.id} className="sp-workspaces__row">
              <Avatar initials={workspaceInitials(c.name)} shape="square" />
              <div className="sp-workspaces__text">
                <span className="t-label-m">{c.name}</span>
                {role && (
                  <span className="t-caption-s sp-workspaces__meta">{ROLE_LABEL[role]}</span>
                )}
              </div>
              {current ? (
                <Status tone="neutral">Current</Status>
              ) : (
                <Button
                  kind="neutral"
                  size="sm"
                  aria-label={`Switch to ${c.name}`}
                  onClick={() => void setCompany(c.id)}
                >
                  Switch
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </SettingsCard>
  );
}
