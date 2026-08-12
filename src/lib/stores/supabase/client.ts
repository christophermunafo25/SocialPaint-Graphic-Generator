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

export function publicUrl(bucket: string, path: string): string {
  return supabase().storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export const BUCKETS = {
  brandAssets: "brand-assets",
  templateBackgrounds: "template-backgrounds",
} as const;
