// Store factory. Components import `stores` from here and never touch a
// backend client directly. Backend selection:
//   - valid VITE_SUPABASE_* config → Supabase (Postgres + Storage + Edge Functions)
//   - unset, dev build             → localStorage dev backend (zero setup)
//   - unset/invalid, prod build    → throw. Never ship the localStorage backend
//     to production: it boots a working-looking app that silently loses
//     everything. main.tsx checks the same config before importing this module
//     and renders the failure screen; the throw here is the backstop.

import type { Stores } from "./interfaces";
import { isSupabaseConfigured } from "./supabase/client";
import { supabaseAnonKey, supabaseEnvProblems, supabaseUrl } from "@/lib/config/supabaseEnv";
import { SupabaseCompanyStore } from "./supabase/companyStore";
import { SupabaseTemplateStore } from "./supabase/templateStore";
import { SupabaseBrandAssetStore, SupabaseBrandKitStore } from "./supabase/brandStore";
import { SupabaseUsageStore } from "./supabase/usageStore";
import { SupabasePeopleStore } from "./supabase/peopleStore";
import { SupabasePublicLinkStore } from "./supabase/publicLinkStore";
import { FigmaImporter } from "./supabase/figmaImporter";
import { SupabaseGenerateProvider } from "./supabase/generateProvider";
import {
  LocalBrandAssetStore,
  LocalBrandKitStore,
  LocalCompanyStore,
  LocalDesignImportProvider,
  LocalGenerateProvider,
  LocalPeopleStore,
  LocalPublicLinkStore,
  LocalTemplateStore,
  LocalUsageStore,
} from "./local/localStores";

function createStores(): Stores {
  if (isSupabaseConfigured) {
    return {
      companies: new SupabaseCompanyStore(),
      templates: new SupabaseTemplateStore(),
      brandKits: new SupabaseBrandKitStore(),
      brandAssets: new SupabaseBrandAssetStore(),
      usage: new SupabaseUsageStore(),
      people: new SupabasePeopleStore(),
      publicLinks: new SupabasePublicLinkStore(),
      designImport: new FigmaImporter(),
      generate: new SupabaseGenerateProvider(),
      backend: "supabase",
    };
  }
  if (import.meta.env.PROD) {
    throw new Error(
      `Supabase configuration is missing or invalid in a production build: ${supabaseEnvProblems.join("; ")}`,
    );
  }
  if (supabaseUrl || supabaseAnonKey) {
    // Partially set or malformed config in dev would otherwise silently mask a
    // typo behind the local backend.
    console.warn(
      `Supabase config ignored (${supabaseEnvProblems.join("; ")}) — falling back to the localStorage dev backend.`,
    );
  }
  return {
    companies: new LocalCompanyStore(),
    templates: new LocalTemplateStore(),
    brandKits: new LocalBrandKitStore(),
    brandAssets: new LocalBrandAssetStore(),
    usage: new LocalUsageStore(),
    people: new LocalPeopleStore(),
    publicLinks: new LocalPublicLinkStore(),
    designImport: new LocalDesignImportProvider(),
    generate: new LocalGenerateProvider(),
    backend: "local",
  };
}

export const stores: Stores = createStores();

export type { Stores } from "./interfaces";
