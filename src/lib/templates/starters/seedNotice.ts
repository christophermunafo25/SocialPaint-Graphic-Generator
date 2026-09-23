// A one-shot notice from onboarding's starter seeding to the template list
// it navigates to. Seeding failure must never fail onboarding, so the
// message rides sessionStorage (same pattern as canvaReturn.ts) and the
// AdminTemplates toast consumes it after the navigation.

const SEED_NOTICE_KEY = "sp-starter-seed-notice";

export function setSeedNotice(message: string): void {
  try {
    sessionStorage.setItem(SEED_NOTICE_KEY, message);
  } catch {
    // Storage unavailable: the console log remains the only trace.
  }
}

/** Reads and clears the notice, so it shows exactly once. */
export function consumeSeedNotice(): string | null {
  try {
    const message = sessionStorage.getItem(SEED_NOTICE_KEY);
    sessionStorage.removeItem(SEED_NOTICE_KEY);
    return message;
  } catch {
    return null;
  }
}
