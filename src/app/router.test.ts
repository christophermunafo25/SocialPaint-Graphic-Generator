import { describe, expect, it } from "vitest";
import {
  generatePageKey,
  routeState,
  routeToUrl,
  templateChatPageKey,
  urlToRoute,
  type Route,
} from "./router";

const parse = (url: string): Route => {
  const u = new URL(url, "http://localhost");
  return urlToRoute(u.pathname, u.search);
};

describe("Generate routes (PROMPT §11.1)", () => {
  it("reads /generate as a new chat", () => {
    expect(parse("/generate")).toEqual({ name: "generate", templateId: undefined });
    expect(routeToUrl({ name: "generate" })).toBe("/generate");
  });

  it("keeps the template hint in the query", () => {
    expect(parse("/generate?template=t%201")).toEqual({ name: "generate", templateId: "t 1" });
    expect(routeToUrl({ name: "generate", templateId: "t 1" })).toBe("/generate?template=t%201");
  });

  it("reads a saved chat at /generate/c/<id>", () => {
    expect(parse("/generate/c/abc-123")).toEqual({ name: "generate", threadId: "abc-123" });
    expect(routeToUrl({ name: "generate", threadId: "abc-123" })).toBe("/generate/c/abc-123");
  });

  it("gives a chat's own address priority over a template hint", () => {
    expect(routeToUrl({ name: "generate", threadId: "abc", templateId: "t" })).toBe(
      "/generate/c/abc",
    );
  });

  it("reads /generate/c with no id as a new chat", () => {
    expect(parse("/generate/c")).toEqual({ name: "generate", templateId: undefined });
  });

  it("reads History with its filters", () => {
    expect(parse("/generate/history")).toEqual({
      name: "generateHistory",
      platform: undefined,
      q: undefined,
    });
    expect(parse("/generate/history?platform=linkedin&q=hiring")).toEqual({
      name: "generateHistory",
      platform: "linkedin",
      q: "hiring",
    });
  });

  it("reads an unknown History platform as no filter, like the portal", () => {
    expect(parse("/generate/history?platform=myspace")).toEqual({
      name: "generateHistory",
      platform: undefined,
      q: undefined,
    });
  });

  it("writes History's filters only when set", () => {
    expect(routeToUrl({ name: "generateHistory" })).toBe("/generate/history");
    expect(routeToUrl({ name: "generateHistory", platform: "instagram" })).toBe(
      "/generate/history?platform=instagram",
    );
    expect(routeToUrl({ name: "generateHistory", q: "open house" })).toBe(
      "/generate/history?q=open+house",
    );
  });

  it("keys a saved chat's page by its id and every new chat's page as one", () => {
    expect(generatePageKey({ name: "generate" })).toBe("new");
    expect(generatePageKey({ name: "generate", templateId: "tpl" })).toBe("new");
    expect(generatePageKey({ name: "generate", threadId: "abc" })).toBe("chat:abc");
    // A chat id can never pose as the new-chat key.
    expect(generatePageKey({ name: "generate", threadId: "new" })).toBe("chat:new");
  });

  it("keeps the new chat's key through its own replace after the first save", () => {
    const saved: Route = { name: "generate", threadId: "abc", savedInPlace: true };
    expect(generatePageKey(saved)).toBe("new");
    // The marker never reaches the address, so a reload or back and
    // forward reads the chat's own key.
    const url = routeToUrl(saved);
    expect(url).toBe("/generate/c/abc");
    const reloaded = parse(url);
    expect(reloaded).toEqual({ name: "generate", threadId: "abc" });
    expect(reloaded.name === "generate" && generatePageKey(reloaded)).toBe("chat:abc");
  });

  it("round-trips every Generate route", () => {
    const routes: Route[] = [
      { name: "generate" },
      { name: "generate", templateId: "tpl" },
      { name: "generate", threadId: "chat" },
      { name: "generateHistory" },
      { name: "generateHistory", platform: "facebook", q: "sale" },
    ];
    for (const route of routes) {
      const url = routeToUrl(route);
      expect(routeToUrl(parse(url))).toBe(url);
    }
  });
});

describe("routeState", () => {
  it("makes a repeat navigation with the same route object a new state", () => {
    // The sidebar's items hand over one constant route on every click.
    const sidebarGenerate: Route = { name: "generate" };
    const first = routeState(sidebarGenerate);
    const second = routeState(sidebarGenerate);
    expect(first).not.toBe(sidebarGenerate);
    expect(second).not.toBe(first);
    expect(second).toEqual(sidebarGenerate);
  });
});

describe("Template chat routes (Template chat PROMPT §12.1)", () => {
  it("reads a new and a saved template chat, keeping edit and field", () => {
    expect(urlToRoute("/templates/t-1/chat", "")).toEqual({
      name: "templateChat",
      templateId: "t-1",
    });
    expect(urlToRoute("/templates/t-1/chat/c-9", "?edit=d-2&field=apply_link")).toEqual({
      name: "templateChat",
      templateId: "t-1",
      threadId: "c-9",
      edit: "d-2",
      field: "apply_link",
    });
    // A field with no draft to edit means nothing.
    expect(urlToRoute("/templates/t-1/chat", "?field=role")).toEqual({
      name: "templateChat",
      templateId: "t-1",
    });
  });

  it("round-trips every template chat route, and leaves the fill and bulk pages alone", () => {
    for (const url of [
      "/templates/t-1/chat",
      "/templates/t-1/chat/c-9",
      "/templates/t-1/chat/c-9?edit=d-2&field=apply_link",
      "/templates/t-1/chat?edit=d-2",
    ]) {
      const [path, qs = ""] = url.split("?");
      expect(routeToUrl(urlToRoute(path, qs ? `?${qs}` : ""))).toBe(url);
    }
    expect(urlToRoute("/templates/t-1", "")).toEqual({ name: "template", templateId: "t-1" });
    expect(urlToRoute("/templates/t-1/bulk", "")).toEqual({ name: "bulk", templateId: "t-1" });
  });

  it("keys the page per template and chat, through the first save and Edit details", () => {
    const key = (r: Parameters<typeof templateChatPageKey>[0]) => templateChatPageKey(r);
    const fresh = key({ name: "templateChat", templateId: "t-1" });
    expect(
      key({ name: "templateChat", templateId: "t-1", threadId: "c", savedInPlace: true }),
    ).toBe(fresh);
    expect(key({ name: "templateChat", templateId: "t-1", threadId: "c" })).not.toBe(fresh);
    expect(key({ name: "templateChat", templateId: "t-1", threadId: "c", edit: "d" })).toBe(
      key({ name: "templateChat", templateId: "t-1", threadId: "c" }),
    );
    expect(key({ name: "templateChat", templateId: "t-2" })).not.toBe(fresh);
  });
});
