import type { DesignImportResult, LayerRenderResult } from "../../types";
import type { DesignImportProvider, StyleImportResult } from "../interfaces";
import { isSupabaseConfigured, supabase } from "./client";

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

  async importFromUrl(companyId: string, url: string): Promise<DesignImportResult> {
    const { data, error } = await supabase().functions.invoke("figma-import", {
      body: { companyId, url },
    });
    if (error) throw new Error(`Figma import failed: ${error.message}`);
    return data as DesignImportResult;
  }

  async importStylesFromUrl(companyId: string, url: string): Promise<StyleImportResult> {
    const { data, error } = await supabase().functions.invoke("figma-styles", {
      body: { companyId, url },
    });
    if (error) throw new Error(`Figma style import failed: ${error.message}`);
    return data as StyleImportResult;
  }

  async renderLayers(
    companyId: string,
    url: string,
    excludeNodeIds: string[],
  ): Promise<LayerRenderResult> {
    const { data, error } = await supabase().functions.invoke("figma-layers", {
      body: { companyId, url, excludeNodeIds },
    });
    if (error) throw new Error(`Layered render failed: ${error.message}`);
    return data as LayerRenderResult;
  }
}
