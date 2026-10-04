import type {
  GenerateInput,
  GenerateRepairInput,
  GenerateRepairResult,
  GenerateResult,
} from "../../types";
import type { GenerateCallOptions, GenerateProvider } from "../interfaces";
import { isSupabaseConfigured, supabase } from "./client";

/** Generate goes through the template-generate Edge Function — the model key
 * lives server-side, the candidate list is built server-side, and validation
 * happens before anything reaches this client. */
export class SupabaseGenerateProvider implements GenerateProvider {
  isConfigured(): boolean {
    return isSupabaseConfigured;
  }

  isTemplateChatAvailable(): boolean {
    return this.isConfigured();
  }

  // The chat's Stop aborts the fetch through functions.invoke's `signal`. An
  // aborted call surfaces as a fetch error with no body, so it throws the
  // fallback sentence below; the chat has already settled the turn as
  // stopped and ignores it.
  async generate(
    companyId: string,
    input: GenerateInput,
    opts?: GenerateCallOptions,
  ): Promise<GenerateResult> {
    const { data, error } = await supabase().functions.invoke("template-generate", {
      body: { companyId, ...input },
      signal: opts?.signal,
    });
    if (error) {
      const detail = await readErrorMessage(error);
      throw new Error(detail ?? "Generate failed. Try again.");
    }
    return data as GenerateResult;
  }

  async repair(
    companyId: string,
    input: GenerateRepairInput,
    opts?: GenerateCallOptions,
  ): Promise<GenerateRepairResult> {
    const { data, error } = await supabase().functions.invoke("template-generate", {
      body: { companyId, repair: input },
      signal: opts?.signal,
    });
    if (error) {
      const detail = await readErrorMessage(error);
      throw new Error(detail ?? "The repair round failed. Try again.");
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
