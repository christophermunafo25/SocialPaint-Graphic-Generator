import { useMemo } from "react";
import type { BrandKit, Role, TemplateSchema } from "@/lib/types";
import { stores } from "@/lib/stores";
import { useAuth } from "@/lib/auth/AuthContext";
import { useBrand } from "@/lib/brand/BrandContext";
import {
  isBrandFromWebsiteAvailable,
  pullBrandFromWebsite,
  type BrandFromWebsiteResult,
} from "@/lib/brand/brandFromWebsite";
import {
  createWorkspace,
  savePerson,
  seedNoticeFor,
  updateWorkspaceBrand,
  type WorkspaceDraft,
  type BrandDraft,
} from "@/lib/onboarding/service";
import { setSeedNotice } from "@/lib/templates/starters/seedNotice";
import { useRouter, type Route } from "../../router";

export interface CreatedWorkspace {
  companyId: string;
  companyName: string;
  kit: BrandKit;
  logoAssetId?: string;
}

/** What the onboarding flow does to the world, apart from its screens
 * (PHASE-8B §9 D8): the real ones save through the stores; /dev/onboarding
 * passes stand-ins, so every step renders without a backend. */
export interface OnboardingServices {
  /** The brand pull needs the brand-from-website Edge Function. */
  pullAvailable: boolean;
  pullBrand(url: string): Promise<BrandFromWebsiteResult>;
  savePerson(person: { name: string; role?: string }): Promise<void>;
  createWorkspace(draft: WorkspaceDraft): Promise<CreatedWorkspace>;
  updateBrand(created: CreatedWorkspace, brand: BrandDraft): Promise<BrandKit>;
  invite(companyId: string, email: string, role: Role): Promise<void>;
  listStarters(companyId: string): Promise<TemplateSchema[]>;
  /** Make the new workspace the active one and open the app there. */
  enter(companyId: string, to: Route): Promise<void>;
  /** The in-app path's Cancel: back to the workspace they came from. */
  leave(): void;
}

const isStarter = (t: TemplateSchema) => t.autobuildMeta?.source === "starter";

/** The real services, on the stores and the auth and brand contexts. */
export function useOnboardingServices(): OnboardingServices {
  const { user, refresh, setCompany, setRole } = useAuth();
  const { refresh: refreshBrand } = useBrand();
  const { navigate } = useRouter();
  return useMemo<OnboardingServices>(
    () => ({
      pullAvailable: isBrandFromWebsiteAvailable(),
      pullBrand: pullBrandFromWebsite,
      savePerson: (person) => savePerson(stores, user?.id, person),
      createWorkspace: async (draft) => {
        const { company, kit, seeded } = await createWorkspace(stores, draft);
        // A seeding shortfall never fails onboarding; it surfaces as a
        // notice on the template list.
        const notice = seedNoticeFor(seeded);
        if (notice) setSeedNotice(notice);
        return {
          companyId: company.id,
          companyName: company.name,
          kit,
          logoAssetId: kit.primaryLogoAssetId,
        };
      },
      updateBrand: (created, brand) =>
        updateWorkspaceBrand(stores, created.companyId, brand, created.logoAssetId),
      invite: (companyId, email, role) => stores.people.invite(companyId, email, role),
      listStarters: async (companyId) =>
        (await stores.templates.listAll(companyId)).filter(isStarter),
      enter: async (companyId, to) => {
        // Real auth already made this person the admin (the
        // create_company_with_admin RPC); setRole is the dev switcher's and
        // a no-op under real auth.
        await refresh();
        await setCompany(companyId);
        setRole("admin");
        await refreshBrand();
        navigate(to);
      },
      leave: () => navigate({ name: "portal" }),
    }),
    [user?.id, refresh, setCompany, setRole, refreshBrand, navigate],
  );
}
