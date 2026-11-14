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
import { SupabaseAccountStore } from "./supabase/accountStore";
import { SupabaseCompanyStore } from "./supabase/companyStore";
import { SupabaseTemplateStore } from "./supabase/templateStore";
import { SupabaseBrandAssetStore, SupabaseBrandKitStore } from "./supabase/brandStore";
import { SupabaseUsageStore } from "./supabase/usageStore";
import { SupabasePeopleStore } from "./supabase/peopleStore";
import { SupabasePublicLinkStore } from "./supabase/publicLinkStore";
import { FigmaImporter } from "./supabase/figmaImporter";
import { SupabaseGenerateProvider } from "./supabase/generateProvider";
import { SupabaseGenerateThreadStore } from "./supabase/generateThreadStore";
import { SupabaseMemberHintStore } from "./supabase/memberHintStore";
import {
  LocalAccountStore,
  LocalBrandAssetStore,
  LocalBrandKitStore,
  LocalCompanyStore,
  LocalDesignImportProvider,
  LocalGenerateProvider,
  LocalGenerateThreadStore,
  LocalMemberHintStore,
  LocalPeopleStore,
  LocalPublicLinkStore,
  LocalTemplateStore,
  LocalUsageStore,
} from "./local/localStores";
import { withDevStall } from "./local/devStall";

function createStores(): Stores {
  if (isSupabaseConfigured) {
    return {
      companies: new SupabaseCompanyStore(),
      account: new SupabaseAccountStore(),
      templates: new SupabaseTemplateStore(),
      brandKits: new SupabaseBrandKitStore(),
      brandAssets: new SupabaseBrandAssetStore(),
      usage: new SupabaseUsageStore(),
      people: new SupabasePeopleStore(),
      publicLinks: new SupabasePublicLinkStore(),
      designImport: new FigmaImporter(),
      generate: new SupabaseGenerateProvider(),
      generateThreads: new SupabaseGenerateThreadStore(),
      memberHints: new SupabaseMemberHintStore(),
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
    companies: withDevStall(new LocalCompanyStore(), "companies"),
    account: withDevStall(new LocalAccountStore(), "account"),
    templates: withDevStall(new LocalTemplateStore(), "templates"),
    brandKits: withDevStall(new LocalBrandKitStore(), "brandKits"),
    brandAssets: withDevStall(new LocalBrandAssetStore(), "brandAssets"),
    usage: withDevStall(new LocalUsageStore(), "usage"),
    people: withDevStall(new LocalPeopleStore(), "people"),
    publicLinks: withDevStall(new LocalPublicLinkStore(), "publicLinks"),
    designImport: withDevStall(new LocalDesignImportProvider(), "designImport"),
    generate: withDevStall(new LocalGenerateProvider(), "generate"),
    generateThreads: withDevStall(new LocalGenerateThreadStore(), "generateThreads"),
    memberHints: withDevStall(new LocalMemberHintStore(), "memberHints"),
    backend: "local",
  };
}

export const stores: Stores = createStores();

export type { Stores } from "./interfaces";
