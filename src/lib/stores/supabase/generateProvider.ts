import type {
  GenerateInput,
  GenerateRepairInput,
  GenerateRepairResult,
  GenerateResult,
} from "../../types";
import type { GenerateProvider } from "../interfaces";
import { isSupabaseConfigured, supabase } from "./client";

/** Generate goes through the template-generate Edge Function — the model key
 * lives server-side, the candidate list is built server-side, and validation
 * happens before anything reaches this client. */
export class SupabaseGenerateProvider implements GenerateProvider {
  isConfigured(): boolean {
    return isSupabaseConfigured;
  }

  async generate(companyId: string, input: GenerateInput): Promise<GenerateResult> {
    const { data, error } = await supabase().functions.invoke("template-generate", {
      body: { companyId, ...input },
    });
    if (error) {
      const detail = await readErrorMessage(error);
      throw new Error(detail ?? "Generate failed — try again.");
    }
    return data as GenerateResult;
  }

  async repair(companyId: string, input: GenerateRepairInput): Promise<GenerateRepairResult> {
    const { data, error } = await supabase().functions.invoke("template-generate", {
      body: { companyId, repair: input },
    });
    if (error) {
      const detail = await readErrorMessage(error);
      throw new Error(detail ?? "The repair round failed — try again.");
    }
    return data as GenerateRepairResult;
  }
}

/** The function answers a refusal with `{ error }` and a 4xx, which
 * functions.invoke surfaces as a transport error whose body the caller
 * cannot see. Read it back so the member gets the real sentence (the quota
 * message, "publish a template first") rather than a status code. Same
 * pattern as publicLinkStore. */
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
