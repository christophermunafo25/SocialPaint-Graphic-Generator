// Onboarding's questions, the answers they collect, and the rules over them
// (new look, Phase 8b; Figma 257:2, PHASE-8B-ONBOARDING-SCREENS.md, §9 D11,
// D13 to D15). Pure, so the flow, its preview and the tests share it.

import type { CompanyProfile } from "../types";
import type { PlatformId } from "../templates/platforms";

export type StepId =
  | "about"
  | "setupFor"
  | "team"
  | "firstUp"
  | "website"
  | "addBrand"
  | "pulling"
  | "brand"
  | "invite"
  | "ready";

export const STEP_IDS: readonly StepId[] = [
  "about",
  "setupFor",
  "team",
  "firstUp",
  "website",
  "addBrand",
  "pulling",
  "brand",
  "invite",
  "ready",
];

export type JobRole =
  "marketing" | "design" | "founder" | "people" | "events" | "sales" | "agency" | "other";
export type SetupFor = NonNullable<CompanyProfile["setupFor"]>;
export type TeamSize = NonNullable<CompanyProfile["teamSize"]>;
export type Maker = "marketing_team" | "employees" | "speakers" | "clients" | "just_me";
export type FirstUp =
  "hiring" | "events" | "speakers" | "product" | "stories" | "team" | "webinars" | "other";
export type PostPlatform = Extract<
  PlatformId,
  "linkedin" | "instagram" | "facebook" | "email" | "web"
>;

export const ROLE_LABEL: Record<JobRole, string> = {
  marketing: "Marketing",
  design: "Design",
  founder: "Founder or owner",
  people: "People and recruiting",
  events: "Events",
  sales: "Sales",
  agency: "Agency or consultant",
  other: "Something else",
};

export const SETUP_FOR: Record<SetupFor, { label: string; description: string }> = {
  company: { label: "My company", description: "One brand and the people who post for it" },
  clients: {
    label: "My clients",
    description: "Several brands I manage as an agency or consultant",
  },
  locations: {
    label: "Our locations",
    description: "A parent company with many locations or businesses",
  },
  just_me: { label: "Just me", description: "My own personal brand" },
};

/** The menu behind "How did you hear about SocialPaint?" (not drawn; the
 * frame shows only "A friend or colleague", PHASE-8B proposed copy). */
export const HEARD_FROM = [
  "A friend or colleague",
  "Search",
  "LinkedIn",
  "Instagram",
  "An event",
  "Something else",
] as const;

export const TEAM_SIZE: Record<TeamSize, string> = {
  just_me: "Just me",
  "2_10": "2–10",
  "11_50": "11–50",
  "51_200": "51–200",
  "201_plus": "201+",
};

export const MAKERS: Record<Maker, string> = {
  marketing_team: "My marketing team",
  employees: "Employees across the company",
  speakers: "Event speakers and attendees",
  clients: "Clients",
  just_me: "Just me",
};

export const FIRST_UP: Record<FirstUp, string> = {
  hiring: "Hiring posts",
  events: "Event promotion",
  speakers: "Speaker announcements",
  product: "Product news",
  stories: "Customer stories",
  team: "Team news",
  webinars: "Webinars",
  other: "Something else",
};

export const POST_PLATFORMS: Record<PostPlatform, string> = {
  linkedin: "LinkedIn",
  instagram: "Instagram",
  facebook: "Facebook",
  email: "Email",
  web: "Web",
};

export interface Answers {
  name: string;
  role?: JobRole;
  setupFor?: SetupFor;
  heardFrom?: string;
  companyName: string;
  teamSize?: TeamSize;
  makers: Maker[];
  firstUp: FirstUp[];
  platforms: PostPlatform[];
  website: string;
}

export const EMPTY_ANSWERS: Answers = {
  name: "",
  companyName: "",
  makers: [],
  firstUp: [],
  platforms: [],
  website: "",
};

export type StepErrors = Partial<Record<keyof Answers, string>>;

/** What a step requires before Continue moves on (D15). Every other answer
 * is optional. */
export function validateStep(step: StepId, a: Answers): StepErrors {
  const errors: StepErrors = {};
  if (step === "about") {
    if (!a.name.trim()) errors.name = "Enter your name.";
    if (!a.role) errors.role = "Choose one.";
  }
  if (step === "setupFor" && !a.setupFor) errors.setupFor = "Choose one.";
  if (step === "team") {
    if (a.companyName.trim().length < 2) errors.companyName = "Enter your company’s name.";
    if (!a.teamSize) errors.teamSize = "Choose one.";
  }
  if (step === "website") {
    const site = a.website.trim();
    if (!site) errors.website = "Enter your website.";
    else if (!/^(https?:\/\/)?[^\s/.]+(\.[^\s/.]+)+(\/\S*)?$/i.test(site)) {
      errors.website = "Enter a website like acme.com.";
    }
  }
  return errors;
}

/** The progress bar's filled segments for a step (258:22): you, set up for,
 * team, first up, brand (website to your brand), invite; none on Workspace
 * ready. The in-app path starts at Your team, so its bar has four (D19). */
export function progressFor(step: StepId, inApp: boolean): { done: number; total: number } | null {
  const order: Partial<Record<StepId, number>> = {
    about: 1,
    setupFor: 2,
    team: 3,
    firstUp: 4,
    website: 5,
    addBrand: 5,
    pulling: 5,
    brand: 5,
    invite: 6,
  };
  const n = order[step];
  if (!n) return null;
  return inApp ? { done: n - 2, total: 4 } : { done: n, total: 6 };
}

/** "Hiring posts and event promotion", "A, B and C". */
export function listPhrase(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  const lower = items.map((s, i) => (i === 0 ? s : s.charAt(0).toLowerCase() + s.slice(1)));
  return `${lower.slice(0, -1).join(", ")} and ${lower[lower.length - 1]}`;
}

/** Platform names keep their capitals: "LinkedIn and Instagram". */
export function platformPhrase(platforms: PostPlatform[]): string {
  const names = platforms.map((p) => POST_PLATFORMS[p]);
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** The workspace's answers as stored (migration 0045). */
export function profileFrom(a: Answers): CompanyProfile {
  return {
    setupFor: a.setupFor,
    heardFrom: a.heardFrom,
    teamSize: a.teamSize,
    makers: a.makers,
    firstUp: a.firstUp,
    platforms: a.platforms,
  };
}

/** The first word of a name, for "Your workspace is ready, CJ". */
export const firstName = (name: string): string => name.trim().split(/\s+/)[0] ?? "";
