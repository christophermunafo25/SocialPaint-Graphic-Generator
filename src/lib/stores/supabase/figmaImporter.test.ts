import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
vi.mock("./client", () => ({
  isSupabaseConfigured: true,
  supabase: () => ({ functions: { invoke } }),
}));

import { FigmaImporter } from "./figmaImporter";

const URL = "https://www.figma.com/design/abc/File?node-id=1-2";
const COMPANY = "11111111-1111-4111-8111-111111111111";

/** What functions.invoke hands back when a function answers with an error
 * status: the body is only reachable through the response on the error. */
const refusal = (status: number, body: unknown = {}) => ({
  data: null,
  error: Object.assign(new Error("Edge Function returned a non-2xx status code"), {
    context: new Response(JSON.stringify(body), { status }),
  }),
});

const IMPORT = { backgroundUrl: "bg", canvasWidth: 1, canvasHeight: 1, suggestedFields: [] };
const ELEMENTS = { elementWidth: 1, elementHeight: 1, fields: [], units: [], warnings: [] };

beforeEach(() => invoke.mockReset());

describe("FigmaImporter: one pipeline, and a fallback that never needs the model", () => {
  it("imports a frame through template-autobuild", async () => {
    invoke.mockResolvedValueOnce({
      data: { ...IMPORT, intent: { filledBy: "model" } },
      error: null,
    });
    const result = await new FigmaImporter().importFromUrl(COMPANY, URL);
    expect(result.intent?.filledBy).toBe("model");
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith("template-autobuild", {
      body: { companyId: COMPANY, source: { kind: "figma", url: URL }, mode: "template" },
    });
  });

  it("falls back to figma-import when there is no model key", async () => {
    invoke
      .mockResolvedValueOnce(refusal(503, { error: "Auto-build is not configured." }))
      .mockResolvedValueOnce({ data: IMPORT, error: null });
    await expect(new FigmaImporter().importFromUrl(COMPANY, URL)).resolves.toEqual(IMPORT);
    expect(invoke).toHaveBeenLastCalledWith("figma-import", {
      body: { companyId: COMPANY, url: URL, mode: "template" },
    });
  });

  it("falls back when the function is missing, fails or can't be reached", async () => {
    for (const first of [
      refusal(404),
      refusal(500, { error: "Something went wrong." }),
      { data: null, error: new Error("Failed to send a request to the Edge Function") },
    ]) {
      invoke.mockReset();
      invoke.mockResolvedValueOnce(first).mockResolvedValueOnce({ data: IMPORT, error: null });
      await expect(new FigmaImporter().importFromUrl(COMPANY, URL)).resolves.toEqual(IMPORT);
      expect(invoke).toHaveBeenCalledTimes(2);
    }
  });

  it("falls back when an older function answers with a proposal, not an import", async () => {
    // Before this phase template-autobuild returned `fields`, not
    // `suggestedFields`. The client can ship ahead of the functions.
    invoke
      .mockResolvedValueOnce({ data: { sourceKind: "figma", fields: [] }, error: null })
      .mockResolvedValueOnce({ data: IMPORT, error: null });
    await expect(new FigmaImporter().importFromUrl(COMPANY, URL)).resolves.toEqual(IMPORT);
  });

  it("takes a refusal as final and says what the function said", async () => {
    invoke.mockResolvedValueOnce(
      refusal(400, { error: "Figma is not connected for this company." }),
    );
    await expect(new FigmaImporter().importFromUrl(COMPANY, URL)).rejects.toThrow(
      "Figma is not connected for this company.",
    );
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("says what figma-import said when the fallback fails too", async () => {
    invoke
      .mockResolvedValueOnce(refusal(503))
      .mockResolvedValueOnce(refusal(400, { error: "That node was not found in the file." }));
    await expect(new FigmaImporter().importFromUrl(COMPANY, URL)).rejects.toThrow(
      "That node was not found in the file.",
    );
  });

  it("pastes a layer through the same pipeline, in elements mode", async () => {
    invoke.mockResolvedValueOnce({ data: ELEMENTS, error: null });
    await expect(new FigmaImporter().importElementsFromUrl(COMPANY, URL)).resolves.toEqual(
      ELEMENTS,
    );
    expect(invoke).toHaveBeenCalledWith("template-autobuild", {
      body: { companyId: COMPANY, source: { kind: "figma", url: URL }, mode: "elements" },
    });

    invoke.mockReset();
    invoke
      .mockResolvedValueOnce(refusal(503))
      .mockResolvedValueOnce({ data: ELEMENTS, error: null });
    await new FigmaImporter().importElementsFromUrl(COMPANY, URL);
    expect(invoke).toHaveBeenLastCalledWith("figma-import", {
      body: { companyId: COMPANY, url: URL, mode: "elements" },
    });
  });

  it("leaves auto build's own errors alone: it asked for the model", async () => {
    invoke.mockResolvedValueOnce(refusal(503, { error: "Auto-build is not configured." }));
    await expect(
      new FigmaImporter().autoBuild(COMPANY, { kind: "figma", url: URL }),
    ).rejects.toThrow("Auto-build is not configured.");
    expect(invoke).toHaveBeenCalledTimes(1);
  });
});
