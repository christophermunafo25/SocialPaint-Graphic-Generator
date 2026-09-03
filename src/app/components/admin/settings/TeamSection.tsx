import React from "react";
import { Users } from "lucide-react";
import { useRouter } from "../../../router";
import { SettingsCard } from "./settingsShared";

/** Deliberately thin: Settings owns team POLICY, People owns people. The
 * member list is not duplicated here, and this section grows real controls
 * (default invite role, domain policy) only when they have storage and an
 * enforcement path — a switch wired to nothing is worse than a sentence. */
export function TeamSection() {
  const { navigate } = useRouter();
  return (
    <div className="space-y-6">
      <SettingsCard
        title="Team"
        description="Members, roles, invites, and removals are managed on the People page."
      >
        <button onClick={() => navigate({ name: "people" })} className="sp-btn sp-btn-primary">
          <Users style={{ width: 14, height: 14 }} />
          Open People
        </button>
      </SettingsCard>
      <p style={{ fontSize: "var(--type-caption-size)", color: "var(--text-muted)" }}>
        Team policy (a default role for invites, joining by email domain) lands here once single
        sign-on does.
      </p>
    </div>
  );
}
