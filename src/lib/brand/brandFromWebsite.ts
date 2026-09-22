// Client caller for the brand-from-website Edge Function. Same invoke +
// read-the-refusal-body pattern as generateProvider/publicLink: the
// function answers refusals with { error } and a 4xx, which
// functions.invoke surfaces as a transport error whose body has to be read
// back for the real sentence.
//
// The function returns a PREFILL for the onboarding wizard. Nothing here
// touches the brand kit: every value passes through the wizard's editable
// steps before anything is saved.

import { isSupabaseConfigured, supabase } from "../stores/supabase/client";

export interface ExtractedBrandColor {
  hex: string;
  role: "primary" | "secondary" | "accent";
  name: string;
}

export interface BrandFromWebsiteResult {
  companyName: string;
  /** The site's hostname, lowercased — the companies.website prefill. */
  website: string;
  colors: ExtractedBrandColor[];
  headingFont: string | null;
  bodyFont: string | null;
  logo?: { base64: string; contentType: string; filename: string };
  warnings: string[];
}

/** The localStorage dev backend has no Edge Functions; the wizard hides the
 * URL screen instead of offering a button that cannot work. */
export const isBrandFromWebsiteAvailable = (): boolean => isSupabaseConfigured;

export async function pullBrandFromWebsite(url: string): Promise<BrandFromWebsiteResult> {
  const { data, error } = await supabase().functions.invoke("brand-from-website", {
    body: { url },
  });
  if (error) {
    const detail = await readErrorMessage(error);
    throw new Error(detail ?? "Your site could not be read. Enter the details manually.");
  }
  return data as BrandFromWebsiteResult;
}

/** The extracted logo as a File for the wizard's existing upload state. */
export function logoToFile(logo: NonNullable<BrandFromWebsiteResult["logo"]>): File {
  const binary = atob(logo.base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], logo.filename || "logo", { type: logo.contentType });
}

async function readErrorMessage(error: unknown): Promise<string | null> {
  const response = (error as { context?: Response }).context;
  if (!(response instanceof Response)) return null;
  try {
    const body = (await response.clone().json()) as { error?: string };
    return typeof body.error === "string" ? body.error : null;
  } catch {
    return null;
  }
}
