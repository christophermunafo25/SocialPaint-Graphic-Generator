import React, { useEffect, useMemo, useState } from "react";
import type { TemplateSchema } from "@/lib/types";
import { stores } from "@/lib/stores";
import { useAuth } from "@/lib/auth/AuthContext";
import { useBrand } from "@/lib/brand/BrandContext";
import { STEP_IDS, type StepId } from "@/lib/onboarding/answers";
import { OnboardingFlow } from "../components/onboarding/OnboardingFlow";
import type { OnboardingServices } from "../components/onboarding/services";
import { useRouter } from "../router";

const SAMPLE_COLORS = [
  { hex: "#0F4C5C", role: "primary" as const, name: "Deep teal" },
  { hex: "#2EC4B6", role: "secondary" as const, name: "Teal" },
  { hex: "#FFBF69", role: "accent" as const, name: "Apricot" },
  { hex: "#F7F4EC", role: "accent" as const, name: "Paper" },
];

/** /dev/onboarding?step= — onboarding's steps without a backend
 * (PHASE-8B §9 D8): any step, with sample answers, on stand-in services.
 * Nothing saves; the pull answers with a sample brand after a beat; the
 * starters are the dev workspace's own templates. Development builds only. */
export function DevOnboardingPage({ step }: { step?: string }) {
  const { company, loading } = useAuth();
  const { kit } = useBrand();
  const { navigate } = useRouter();
  const [starters, setStarters] = useState<TemplateSchema[] | null>(null);
  useEffect(() => {
    if (loading) return;
    if (!company) return setStarters([]);
    void stores.templates.listAll(company.id).then((t) => setStarters(t.slice(0, 6)));
  }, [company, loading]);

  const start = (STEP_IDS as readonly string[]).includes(step ?? "") ? (step as StepId) : "about";
  const late = ["brand", "invite", "ready"].includes(start);
  const answered = start !== "about";

  const services = useMemo<OnboardingServices>(
    () => ({
      pullAvailable: true,
      pullBrand: async (url) => {
        await new Promise((r) => setTimeout(r, 900));
        return {
          companyName: "Acme Studios",
          website: url,
          colors: SAMPLE_COLORS.slice(0, 3),
          headingFont: "Manrope",
          bodyFont: "Manrope",
          warnings: [],
        };
      },
      savePerson: async () => {},
      createWorkspace: async (draft) => ({
        companyId: company?.id ?? "dev",
        companyName: draft.name,
        kit: kit!,
      }),
      updateBrand: async () => kit!,
      invite: async () => {},
      listStarters: async () => starters ?? [],
      enter: async (_id, to) => navigate(to),
      leave: () => navigate({ name: "portal" }),
    }),
    [company, kit, starters, navigate],
  );

  if (loading || starters === null) return null;
  return (
    <OnboardingFlow
      key={start}
      services={services}
      initial={{
        step: start,
        answers: answered
          ? {
              name: "Jordan Lee",
              role: "marketing",
              setupFor: "company",
              heardFrom: "A friend or colleague",
              companyName: start === "setupFor" ? "" : "Acme Studios",
              teamSize: "11_50",
              makers: ["marketing_team", "employees"],
              firstUp: ["hiring", "events"],
              platforms: ["linkedin", "instagram"],
              website: "acmestudios.com",
            }
          : undefined,
        brand:
          late || start === "addBrand"
            ? {
                colors: start === "addBrand" ? SAMPLE_COLORS.slice(0, 2) : SAMPLE_COLORS,
                headingFont: "Manrope",
                bodyFont: late ? "Manrope" : undefined,
              }
            : undefined,
        created:
          (start === "invite" || start === "ready") && company && kit
            ? { companyId: company.id, companyName: "Acme Studios", kit }
            : undefined,
        starters: start === "invite" || start === "ready" ? starters : undefined,
        midPull: start === "pulling",
      }}
    />
  );
}
