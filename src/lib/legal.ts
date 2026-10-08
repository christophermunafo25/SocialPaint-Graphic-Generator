// Where the Terms of Service and Privacy Policy live. Neither page exists
// yet (CJ, 2026-10-08, PHASE-8B §9 D2), so both point at placeholders. The
// sign-in footer, the sign-up consent line and onboarding's footer read
// from here, so this file is the one place to change when the pages exist.

export interface LegalLink {
  label: string;
  href: string;
  /** True until the real page exists. */
  placeholder: boolean;
}

export const TERMS: LegalLink = { label: "Terms of Service", href: "#terms", placeholder: true };
export const PRIVACY: LegalLink = { label: "Privacy Policy", href: "#privacy", placeholder: true };
