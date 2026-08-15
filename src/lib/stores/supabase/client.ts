import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from "@/lib/config/supabaseEnv";

export { isSupabaseConfigured };

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see .env.example).",
    );
  }
  if (!client) client = createClient(supabaseUrl!, supabaseAnonKey!);
  return client;
}

// The buckets are private (migration 0025): there is no publicUrl() any
// more. Reads go through signedUrls.ts; persisted values are storage
// references (storageRef.ts).
export { BUCKETS } from "../storageRef";
