import type { NotificationPrefs } from "../../types";
import type { AccountStore } from "../interfaces";
import { isSupabaseConfigured, supabase } from "./client";

const DEFAULT_PREFS: NotificationPrefs = {
  inviteAccepted: true,
  weeklyDigest: true,
  linkExpiring: true,
};

/** The signed-in user's own row in users, plus user_notification_prefs.
 * Both are self-scoped by RLS (self_update_users, self_*_notification_prefs)
 * — no Edge Function needed. */
export class SupabaseAccountStore implements AccountStore {
  isAvailable(): boolean {
    return isSupabaseConfigured;
  }

  async getDisplayName(userId: string): Promise<string | null> {
    const { data, error } = await supabase()
      .from("users")
      .select("name")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    return (data as { name: string | null } | null)?.name ?? null;
  }

  async setDisplayName(userId: string, name: string): Promise<void> {
    const { error } = await supabase().from("users").update({ name }).eq("id", userId);
    if (error) throw error;
  }

  async getNotificationPrefs(userId: string): Promise<NotificationPrefs> {
    const { data, error } = await supabase()
      .from("user_notification_prefs")
      .select("invite_accepted, weekly_digest, link_expiring")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    const row = data as {
      invite_accepted: boolean;
      weekly_digest: boolean;
      link_expiring: boolean;
    } | null;
    if (!row) return { ...DEFAULT_PREFS };
    return {
      inviteAccepted: row.invite_accepted,
      weeklyDigest: row.weekly_digest,
      linkExpiring: row.link_expiring,
    };
  }

  async setNotificationPrefs(userId: string, prefs: NotificationPrefs): Promise<void> {
    const { error } = await supabase().from("user_notification_prefs").upsert(
      {
        user_id: userId,
        invite_accepted: prefs.inviteAccepted,
        weekly_digest: prefs.weeklyDigest,
        link_expiring: prefs.linkExpiring,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) throw error;
  }
}
