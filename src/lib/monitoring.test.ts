import { describe, expect, it } from "vitest";
import { scrubBreadcrumb, scrubEvent, scrubText, scrubUrl } from "./monitoring";
import type { Breadcrumb, ErrorEvent as SentryErrorEvent } from "@sentry/react";

// The contract under test: no customer content leaves in an error payload —
// no field values, no storage/asset URLs, no data URIs, no emails, no query
// strings (OAuth codes, signed-URL tokens), no console breadcrumb args.

describe("scrubText", () => {
  it("redacts Supabase storage URLs (backgrounds, brand assets, uploads)", () => {
    const s =
      "Image load failed https://abc.supabase.co/storage/v1/object/public/template-backgrounds/co-1/figma-123.png retrying";
    expect(scrubText(s)).toBe("Image load failed [storage-url] retrying");
  });

  it("redacts data URIs (inlined field images)", () => {
    const s = `decode failed for data:image/png;base64,${"A".repeat(64)} at offset 3`;
    expect(scrubText(s)).toBe("decode failed for [data-uri] at offset 3");
  });

  it("redacts email addresses", () => {
    expect(scrubText("invite failed for pat.lee+work@example.co.uk")).toBe(
      "invite failed for [email]",
    );
  });

  it("leaves ordinary technical messages alone", () => {
    const s = "Cannot read properties of undefined (reading 'width')";
    expect(scrubText(s)).toBe(s);
  });
});

describe("scrubUrl", () => {
  it("drops query strings and fragments (OAuth codes, signed tokens)", () => {
    expect(scrubUrl("https://app.example.com/?canva_oauth=1&code=SECRET&state=xyz")).toBe(
      "https://app.example.com/",
    );
  });

  it("still redacts storage paths after the query is gone", () => {
    expect(
      scrubUrl("https://abc.supabase.co/storage/v1/object/sign/brand-assets/logo.png?token=t"),
    ).toBe("[storage-url]");
  });
});

describe("scrubBreadcrumb", () => {
  it("drops console breadcrumbs entirely (args embed record content)", () => {
    expect(scrubBreadcrumb({ category: "console", message: "save failed {…}" })).toBeNull();
  });

  it("keeps only method/url/status of network breadcrumbs, with the url scrubbed", () => {
    const crumb: Breadcrumb = {
      category: "fetch",
      data: {
        url: "https://abc.supabase.co/rest/v1/templates?select=*&company_id=eq.co-1",
        method: "GET",
        status_code: 500,
        response_body_size: 512,
        request_body: '{"fields":[{"label":"Employee name"}]}',
      },
    };
    const out = scrubBreadcrumb(crumb)!;
    expect(out.data).toEqual({
      url: "https://abc.supabase.co/rest/v1/templates",
      method: "GET",
      status_code: 500,
    });
  });
});

describe("scrubEvent", () => {
  it("scrubs exception values, request url, and the user down to an id", () => {
    const event = {
      message: "boom at data:image/png;base64," + "B".repeat(32),
      exception: {
        values: [
          {
            value: "failed https://abc.supabase.co/storage/v1/object/public/brand-assets/x.woff2",
          },
        ],
      },
      request: {
        url: "https://app.example.com/templates/t-1?code=SECRET",
        query_string: "code=SECRET",
      },
      user: { id: "u-1", email: "someone@example.com", username: "Pat" },
      breadcrumbs: [
        { category: "console", message: "leak {…}" },
        { category: "ui.click", message: "button.sp-btn" },
      ],
    } as unknown as SentryErrorEvent;

    const out = scrubEvent(event)!;
    expect(out.message).toBe("boom at [data-uri]");
    expect(out.exception!.values![0].value).toBe("failed [storage-url]");
    expect(out.request!.url).toBe("https://app.example.com/templates/t-1");
    expect(out.request!.query_string).toBeUndefined();
    expect(out.user).toEqual({ id: "u-1" });
    expect(out.breadcrumbs).toHaveLength(1);
    expect(out.breadcrumbs![0].category).toBe("ui.click");
  });
});
