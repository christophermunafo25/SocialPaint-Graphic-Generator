import { describe, expect, it } from "vitest";
import { routeToUrl, urlToRoute, type Route } from "./router";

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
