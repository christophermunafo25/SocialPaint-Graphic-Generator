import React from "react";
import { Plus } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { stores } from "@/lib/stores";
import { useAsync } from "@/lib/useAsync";
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

/** "Admin · 26 people": the person's role there, then the head count where
 * the app can read it. */
export function workspaceMeta(role: string | undefined, people: number | undefined): string {
  return [role, people ? `${people} ${people === 1 ? "person" : "people"}` : null]
    .filter(Boolean)
    .join(" · ");
}

/** Settings › Workspace, Workspaces (Figma 13:14698): every workspace the
 * person belongs to, the current one marked, the others one Switch away,
 * and Add workspace, which opens the Create company flow. The meta line is
 * the person's role there, then its head count where they are an admin:
 * a member can read only their own membership, so no count is ever made up
 * (PHASE-7 §9 D2). */
export function WorkspacesCard() {
  const { company, companies, roleFor, setCompany } = useAuth();
  const { navigate } = useRouter();
  const adminIds = companies.filter((c) => roleFor(c.id) === "admin").map((c) => c.id);
  const counts = useAsync(async () => {
    const entries = await Promise.all(
      adminIds.map(async (id) => {
        try {
          return [id, (await stores.people.list(id)).length] as const;
        } catch {
          return [id, 0] as const;
        }
      }),
    );
    return new Map(entries);
  }, [adminIds.join(",")]);
  const countFor = (id: string) => (counts.status === "ready" ? counts.data.get(id) : undefined);

  return (
    <SettingsCard
      className="sp-st-gap-8"
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
                  <span className="t-label-xs sp-workspaces__meta">
                    {workspaceMeta(ROLE_LABEL[role], countFor(c.id))}
                  </span>
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
