import React, { useState } from "react";
import type { Role } from "@/lib/types";
import type { Member } from "@/lib/stores/interfaces";
import { stores } from "@/lib/stores";
import { useAsync } from "@/lib/useAsync";
import { useAuth } from "@/lib/auth/AuthContext";
import { ErrorState } from "../../ErrorState";
import { SkeletonRows } from "../../Skeleton";
import { Avatar, Button, Input, RowMenu, Select, SettingsCard } from "../../primitives";
import { ConfirmModal } from "./SettingsConfirm";
import { DevBackendNotice } from "./settingsShared";
import { useSettingsToast } from "./settingsToast";

const ROLE_OPTIONS: Array<{ value: Role; label: string }> = [
  { value: "member", label: "Member" },
  { value: "admin", label: "Admin" },
];

/** Rows shown before "Show all {n} people" (PHASE-7 §9 D8). */
const CAP = 8;

/** You first, then admins, then members, each by name (or email). */
export function sortMembers(members: Member[], viewerId: string | undefined): Member[] {
  const key = (m: Member) => (m.name ?? m.email).toLowerCase();
  const rank = (m: Member) => (m.userId === viewerId ? 0 : m.role === "admin" ? 1 : 2);
  return [...members].sort((a, b) => rank(a) - rank(b) || key(a).localeCompare(key(b)));
}

/** "26 people · 3 admins". */
export function peopleMeta(members: Member[]): string {
  const admins = members.filter((m) => m.role === "admin").length;
  const people = `${members.length} ${members.length === 1 ? "person" : "people"}`;
  return `${people} · ${admins} ${admins === 1 ? "admin" : "admins"}`;
}

/** Two letters for a member: the first letters of their first two names,
 * or the first two letters of their email. */
export function memberInitials(m: Member): string {
  const words = (m.name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) return (words[0][0] + words[1][0]).toUpperCase();
  const local = m.email.split("@")[0].replace(/[^a-z0-9]/gi, "");
  return (words[0] ?? local).slice(0, 2).toUpperCase();
}

/** Settings › People (13:14769): invite by email, change roles, remove.
 * Invites are sent by the invite-member Edge Function (admin-verified
 * server-side), and an invited person is a member at once. Rows show the
 * name over the email; the list stops at eight with "Show all {n} people"
 * (PHASE-7 §9 D2, D8). */
export function PeopleSection() {
  const { company, user, isDevAuth } = useAuth();
  const toast = useSettingsToast();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [busy, setBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [removing, setRemoving] = useState<Member | null>(null);

  /** Bumped after mutations so the list reloads through the same hook. */
  const [version, setVersion] = useState(0);
  const reload = () => setVersion((v) => v + 1);
  const membersState = useAsync(
    () => (company ? stores.people.list(company.id) : Promise.resolve([])),
    [company, version],
  );
  const members = membersState.status === "ready" ? sortMembers(membersState.data, user?.id) : [];
  const shown = showAll ? members : members.slice(0, CAP);

  const failed = (e: unknown, fallback: string) =>
    toast(e instanceof Error && e.message ? e.message : fallback);

  const invite = async () => {
    const address = email.trim().toLowerCase();
    if (!company || !address) return;
    setBusy(true);
    try {
      await stores.people.invite(company.id, address, role);
      toast(`Invite sent to ${address}.`);
      setEmail("");
      reload();
    } catch (e) {
      failed(e, "Invite failed.");
    } finally {
      setBusy(false);
    }
  };

  const confirmRemove = () => {
    if (!company || !removing) return;
    const who = removing;
    setRemoving(null);
    void stores.people
      .remove(company.id, who.userId)
      .then(reload)
      .catch((e) => failed(e, `Couldn't remove ${who.name ?? who.email}.`));
  };

  const changeRole = (m: Member, next: Role) => {
    if (!company || next === m.role) return;
    void stores.people
      .setRole(company.id, m.userId, next)
      .then(reload)
      .catch((e) => failed(e, `Couldn't change ${m.name ?? m.email}'s role.`));
  };

  return (
    <div className="sp-st-section">
      <ConfirmModal
        open={removing !== null}
        title={`Remove ${removing?.name ?? removing?.email ?? ""} from ${company?.name ?? "this workspace"}?`}
        body="They lose access to this workspace straight away. You can invite them again later."
        confirmLabel="Remove member"
        onCancel={() => setRemoving(null)}
        onConfirm={confirmRemove}
      />

      <SettingsCard
        title="People"
        action={
          members.length > 0 && <span className="t-label-xs sp-st-meta">{peopleMeta(members)}</span>
        }
      >
        {isDevAuth && (
          <DevBackendNotice>
            People management needs the Supabase backend with auth enabled. This dev backend has no
            real accounts.
          </DevBackendNotice>
        )}

        <div className="sp-st-invite">
          <Input
            type="email"
            aria-label="Invite email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void invite()}
            placeholder="name@company.com"
            disabled={isDevAuth}
          />
          <Select
            ariaLabel="Invite as"
            size="lg"
            className="sp-st-invite__role"
            value={role}
            options={ROLE_OPTIONS}
            onSelect={(v) => setRole(v as Role)}
            disabled={isDevAuth}
          />
          <Button
            kind="primary"
            size="md"
            disabled={busy || !email.trim() || isDevAuth}
            onClick={() => void invite()}
          >
            {busy ? "Inviting…" : "Invite"}
          </Button>
        </div>

        {membersState.status === "loading" ? (
          <SkeletonRows rows={3} inset="var(--space-xs) 0" label="Loading your team" />
        ) : membersState.status === "error" ? (
          <ErrorState
            title="We couldn't load your team."
            detail="Check your connection and try again."
            onRetry={membersState.retry}
          />
        ) : members.length === 0 ? (
          <p className="t-body-s sp-st-empty">No members yet.</p>
        ) : (
          <ul className="sp-st-list">
            {shown.map((m) => {
              const you = m.userId === user?.id;
              const name = m.name ?? m.email;
              return (
                <li key={m.userId} className="sp-st-member">
                  <Avatar initials={memberInitials(m)} />
                  <span className="sp-st-member__text">
                    <span className="sp-st-member__name">
                      <span className="t-label-m">{name}</span>
                      {you && <span className="t-label-m sp-st-meta">(you)</span>}
                    </span>
                    {m.name && <span className="t-label-xs sp-st-meta">{m.email}</span>}
                  </span>
                  <Select
                    ariaLabel={`Role for ${name}`}
                    className="sp-st-member__role"
                    value={m.role}
                    options={ROLE_OPTIONS}
                    onSelect={(next) => changeRole(m, next as Role)}
                    disabled={you}
                  />
                  <RowMenu
                    label={`More actions for ${name}`}
                    disabled={you}
                    groups={[
                      {
                        items: [
                          {
                            label: "Remove from workspace",
                            destructive: true,
                            onSelect: () => setRemoving(m),
                          },
                        ],
                      },
                    ]}
                  />
                </li>
              );
            })}
          </ul>
        )}

        {members.length > CAP && (
          <button
            type="button"
            className="ui-reset ui-ring t-label-m sp-st-show-all"
            aria-expanded={showAll}
            onClick={() => setShowAll((v) => !v)}
          >
            {showAll ? "Show fewer" : `Show all ${members.length} people`}
          </button>
        )}
      </SettingsCard>
    </div>
  );
}
