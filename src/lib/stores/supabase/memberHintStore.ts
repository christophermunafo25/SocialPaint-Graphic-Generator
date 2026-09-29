import type { MemberHintState, MemberHintStore } from "../interfaces";
import { supabase } from "./client";

/** member_hints (migration 0039): one self-scoped row per user, written
 * only through its two atomic RPCs so two tabs never lose a count. */
export class SupabaseMemberHintStore implements MemberHintStore {
  async get(userId: string): Promise<MemberHintState> {
    const { data, error } = await supabase()
      .from("member_hints")
      .select("plus_opened_at, template_chats_started")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    const row = data as { plus_opened_at: string | null; template_chats_started: number } | null;
    return {
      plusOpened: Boolean(row?.plus_opened_at),
      templateChatsStarted: row?.template_chats_started ?? 0,
    };
  }

  async markPlusOpened(): Promise<void> {
    const { error } = await supabase().rpc("mark_plus_opened");
    if (error) throw error;
  }

  async noteTemplateChatStarted(): Promise<number> {
    const { data, error } = await supabase().rpc("note_template_chat_started");
    if (error) throw error;
    return typeof data === "number" ? data : Number(data ?? 0);
  }
}
