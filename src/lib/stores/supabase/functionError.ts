/** A function answers a refusal with `{ error }` and a 4xx or 5xx, which
 * functions.invoke surfaces as a transport error whose body the caller
 * cannot see. Read it back so the admin gets the real sentence ("Cancel the
 * plan before deleting this workspace.") rather than a status code. Same
 * pattern as figmaImporter, generateProvider and publicLinkStore. */
export async function readFunctionError(error: unknown): Promise<string | null> {
  const response = (error as { context?: Response }).context;
  if (!(response instanceof Response)) return null;
  try {
    const body = (await response.clone().json()) as { error?: string };
    return typeof body.error === "string" ? body.error : null;
  } catch {
    return null;
  }
}
