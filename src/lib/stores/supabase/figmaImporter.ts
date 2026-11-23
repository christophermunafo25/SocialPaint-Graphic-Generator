import type {
  AutoBuildResult,
  DesignImportResult,
  DesignSource,
  LayerRenderResult,
} from "../../types";
import type { DesignImportProvider, StyleImportResult } from "../interfaces";
import { isSupabaseConfigured, supabase } from "./client";

/** A function answers a refusal with `{ error }` and a 4xx or 5xx, which
 * functions.invoke surfaces as a transport error whose body the caller
 * cannot see. Read it back so the admin gets the real sentence (which Canva
 * refusal, which validation failed) rather than a status code. Same pattern
 * as generateProvider and publicLinkStore. */
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

/**
 * Figma importer. The client NEVER talks to Figma directly — every call goes
 * through Supabase Edge Functions (supabase/functions/figma-*), which hold the
 * OAuth secret / personal access token server-side in integration_connections.
 */
export class FigmaImporter implements DesignImportProvider {
  readonly providers: import("../../types").DesignSourceKind[] = ["figma", "image"];

  isConfigured(): boolean {
    return isSupabaseConfigured;
  }

  async isConnected(companyId: string): Promise<boolean> {
    const { data, error } = await supabase().functions.invoke("figma-status", {
      body: { companyId },
    });
    if (error) return false;
    return Boolean((data as { connected: boolean }).connected);
  }

  async connect(
    companyId: string,
    credential: { kind: "oauth-code" | "pat"; value: string },
  ): Promise<void> {
    const { error } = await supabase().functions.invoke("figma-connect", {
      body: { companyId, ...credential },
    });
    if (error) throw new Error(`Figma connect failed: ${error.message}`);
  }

  /** One Figma import. template-autobuild runs it and asks the model for
   * what the layer names leave open. When that function can't answer (no
   * model key, not deployed yet, a server error), figma-import runs the
   * same import without the model, so an import never depends on it. A
   * refusal (a bad link, Figma not connected) is final: the fallback would
   * only say it again. */
  private async figmaImport<T>(
    companyId: string,
    url: string,
    mode: "template" | "elements",
    shaped: (data: unknown) => data is T,
    failure: string,
  ): Promise<T> {
    const first = await supabase().functions.invoke("template-autobuild", {
      body: { companyId, source: { kind: "figma", url }, mode },
    });
    if (!first.error && shaped(first.data)) return first.data;
    if (first.error) {
      const status = (first.error as { context?: Response }).context?.status;
      if (status !== undefined && status >= 400 && status < 500 && status !== 404) {
        throw new Error(
          (await readErrorMessage(first.error)) ?? `${failure}: ${first.error.message}`,
        );
      }
    }
    const { data, error } = await supabase().functions.invoke("figma-import", {
      body: { companyId, url, mode },
    });
    if (error) throw new Error((await readErrorMessage(error)) ?? `${failure}: ${error.message}`);
    return data as T;
  }

  async importFromUrl(companyId: string, url: string): Promise<DesignImportResult> {
    return this.figmaImport(
      companyId,
      url,
      "template",
      (d): d is DesignImportResult =>
        Array.isArray((d as DesignImportResult | null)?.suggestedFields),
      "Figma import failed",
    );
  }

  async importElementsFromUrl(
    companyId: string,
    url: string,
  ): Promise<import("../../types").ElementImportResult> {
    return this.figmaImport(
      companyId,
      url,
      "elements",
      (d): d is import("../../types").ElementImportResult =>
        Array.isArray((d as { units?: unknown } | null)?.units),
      "Figma element import failed",
    );
  }

  async importStylesFromUrl(companyId: string, url: string): Promise<StyleImportResult> {
    const { data, error } = await supabase().functions.invoke("figma-styles", {
      body: { companyId, url },
    });
    if (error) throw new Error(`Figma style import failed: ${error.message}`);
    return data as StyleImportResult;
  }

  async autoBuild(
    companyId: string,
    source: DesignSource,
    hint?: string,
  ): Promise<AutoBuildResult | DesignImportResult> {
    const { data, error } = await supabase().functions.invoke("template-autobuild", {
      body: { companyId, source, hint },
    });
    if (error) {
      throw new Error((await readErrorMessage(error)) ?? `Auto-build failed: ${error.message}`);
    }
    return data as AutoBuildResult | DesignImportResult;
  }

  async canvaStatus(companyId: string): Promise<{ enabled: boolean; connected: boolean }> {
    const { data, error } = await supabase().functions.invoke("canva-auth", {
      body: { companyId, action: "status" },
    });
    if (error) return { enabled: false, connected: false };
    return data as { enabled: boolean; connected: boolean };
  }

  async canvaConnectStart(
    companyId: string,
    redirectUri: string,
  ): Promise<{ authorizeUrl: string }> {
    const { data, error } = await supabase().functions.invoke("canva-auth", {
      body: { companyId, action: "start", redirectUri },
    });
    if (error) {
      throw new Error((await readErrorMessage(error)) ?? `Canva connect failed: ${error.message}`);
    }
    return data as { authorizeUrl: string };
  }

  async canvaConnectCallback(
    companyId: string,
    code: string,
    state: string,
    redirectUri: string,
  ): Promise<void> {
    const { error } = await supabase().functions.invoke("canva-auth", {
      body: { companyId, action: "callback", code, state, redirectUri },
    });
    if (error) {
      throw new Error((await readErrorMessage(error)) ?? `Canva connect failed: ${error.message}`);
    }
  }

  async connectionInfo(
    companyId: string,
  ): Promise<import("../../types").IntegrationConnectionInfo[]> {
    const { data, error } = await supabase().functions.invoke("integration-status", {
      body: { companyId },
    });
    if (error) throw new Error(`Could not load integration status: ${error.message}`);
    return (data as { connections: import("../../types").IntegrationConnectionInfo[] }).connections;
  }

  async disconnect(companyId: string, provider: "figma" | "canva"): Promise<void> {
    // Each provider's own auth function owns its lifecycle; disconnect is an
    // action on it rather than a third place that touches the tokens table.
    const { error } =
      provider === "figma"
        ? await supabase().functions.invoke("figma-connect", {
            body: { companyId, action: "disconnect" },
          })
        : await supabase().functions.invoke("canva-auth", {
            body: { companyId, action: "disconnect" },
          });
    if (error) throw new Error(`Disconnect failed: ${error.message}`);
  }

  async renderLayers(
    companyId: string,
    url: string,
    excludeNodeIds: string[],
    tree?: unknown,
  ): Promise<LayerRenderResult> {
    const { data, error } = await supabase().functions.invoke("figma-layers", {
      body: { companyId, url, excludeNodeIds, tree },
    });
    if (error) throw new Error(`Layered render failed: ${error.message}`);
    return data as LayerRenderResult;
  }
}
