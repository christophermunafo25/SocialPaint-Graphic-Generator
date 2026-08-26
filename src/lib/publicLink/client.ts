// The anonymous read client.
//
// Plain fetch, deliberately: this module is the whole data layer for the
// public page, and it must not be able to reach the authenticated Supabase
// client even by accident. It never imports src/lib/stores.
//
// What comes back is mapped by the SAME row mappers the authenticated client
// uses (toTemplate, toBrandKit, toBrandAsset). That is what guarantees a
// public fill and a member fill render from identical data — and therefore
// export an identical PNG.

import type { BrandAsset, BrandKit, TemplateSchema } from "../types";
import { supabaseUrl } from "../config/supabaseEnv";
import {
  toBrandAsset,
  toBrandKit,
  toTemplate,
  type BrandAssetRow,
  type BrandKitRow,
  type TemplateRow,
} from "../stores/supabase/rows";

/** Why a public link did not open. The server refuses every ineligible token
 * identically, so the client cannot tell expired from revoked from
 * never-existed — and the page must not pretend otherwise. */
export type PublicLinkFailure = "unavailable" | "rate-limited" | "offline";

export class PublicLinkError extends Error {
  constructor(readonly reason: PublicLinkFailure) {
    super(reason);
    this.name = "PublicLinkError";
  }
}

export interface PublicTemplate {
  template: TemplateSchema;
  brandKit: BrandKit;
  /** Uploaded font files the schema renders with, already signed. */
  fontAssets: BrandAsset[];
  /** Whether image fields accept an upload through this link. */
  allowUploads: boolean;
  /** Lifetime of the signed asset URLs in this response, in seconds. */
  assetTtlSeconds: number;
}

interface PublicPayload {
  template: TemplateRow;
  brandKit: BrandKitRow;
  fontAssets: BrandAssetRow[];
  allowUploads: boolean;
  assetTtlSeconds: number;
}

const endpoint = (name: string): string => `${supabaseUrl}/functions/v1/${name}`;

async function post(name: string, body: unknown): Promise<Response> {
  try {
    return await fetch(endpoint(name), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    // A dead connection is not a dead link, and telling a speaker on a train
    // that their link is invalid would send them to the wrong person.
    throw new PublicLinkError("offline");
  }
}

/** Fetch the one template this token opens.
 *
 * The token travels in the body, never the URL — a token in a query string
 * ends up in referrer headers and proxy logs. */
export async function fetchPublicTemplate(token: string): Promise<PublicTemplate> {
  const response = await post("public-template", { token });
  if (response.status === 429) throw new PublicLinkError("rate-limited");
  if (!response.ok) throw new PublicLinkError("unavailable");

  let payload: PublicPayload;
  try {
    payload = (await response.json()) as PublicPayload;
  } catch {
    throw new PublicLinkError("unavailable");
  }
  if (!payload?.template) throw new PublicLinkError("unavailable");

  return {
    template: toTemplate(payload.template),
    brandKit: toBrandKit(payload.brandKit),
    fontAssets: (payload.fontAssets ?? []).map(toBrandAsset),
    allowUploads: payload.allowUploads !== false,
    assetTtlSeconds: payload.assetTtlSeconds ?? 300,
  };
}

/** Tell the admin who sent this link that it produced a graphic.
 *
 * Fire and forget in every sense: it counts an event, it identifies nobody,
 * and a failure here must never be something the visitor sees. */
export function recordPublicDownload(token: string): void {
  void post("public-link-event", { token, action: "download" }).catch(() => undefined);
}
