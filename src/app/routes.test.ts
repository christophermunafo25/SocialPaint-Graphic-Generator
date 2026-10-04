import { describe, expect, it } from "vitest";
import {
  resolveSettingsSection,
  settingsSectionsFor,
} from "./components/admin/settings/settingsSections";
import { routeToUrl, screenFor, urlToRoute, type SettingsSection } from "./router";

/** What an address shows a role: the screen, and for Settings the section
 * it lands on. The new look must keep every address reachable, and a member
 * must reach exactly what they reached before (PHASE-3.md §3). */
function lands(url: string, role: "admin" | "member"): string {
  const [path, query = ""] = url.split("?");
  const route = urlToRoute(path, query ? `?${query}` : "");
  const screen = screenFor(route, role);
  if (screen !== "settings" || route.name !== "settings") return screen;
  return `settings/${resolveSettingsSection(route.section, role)}`;
}

const TABLE: Array<[url: string, admin: string, member: string]> = [
  ["/", "portal", "portal"],
  ["/templates", "portal", "portal"],
  ["/templates?platform=instagram&q=hiring", "portal", "portal"],
  ["/templates/t1", "template", "template"],
  ["/templates/t1/chat", "templateChat", "templateChat"],
  ["/templates/t1/chat/c1", "templateChat", "templateChat"],
  ["/templates/t1/bulk", "bulk", "portal"],
  ["/generate", "generate", "generate"],
  ["/generate/c/c1", "generate", "generate"],
  ["/generate/history", "generateHistory", "generateHistory"],
  ["/template-builder", "adminTemplates", "portal"],
  ["/template-builder/new", "builder", "portal"],
  ["/insights", "dashboard", "portal"],
  ["/brand-studio", "brandStudio", "portal"],
  ["/brand-studio/colors", "brandStudio", "portal"],
  ["/onboarding", "onboarding", "onboarding"],
  ["/settings", "settings/workspace", "settings/account"],
  ["/settings/workspace", "settings/workspace", "settings/account"],
  ["/settings/people", "settings/people", "settings/account"],
  ["/settings/integrations", "settings/integrations", "settings/account"],
  ["/settings/usage", "settings/usage", "settings/account"],
  ["/settings/sharing", "settings/sharing", "settings/account"],
  ["/settings/account", "settings/account", "settings/account"],
  ["/settings/advanced", "settings/advanced", "settings/account"],
  ["/settings/nonsense", "settings/workspace", "settings/account"],
  // People moved into Settings: the old addresses land on its section.
  ["/people", "settings/people", "settings/account"],
  ["/settings/team", "settings/people", "settings/account"],
  ["/somewhere-else", "portal", "portal"],
];

describe("every address, for each role", () => {
  it.each(TABLE)("%s shows an admin %s and a member %s", (url, admin, member) => {
    expect(lands(url, "admin")).toBe(admin);
    expect(lands(url, "member")).toBe(member);
  });

  it("rewrites the old People addresses to Settings › People", () => {
    expect(routeToUrl(urlToRoute("/people", ""))).toBe("/settings/people");
    expect(routeToUrl(urlToRoute("/settings/team", ""))).toBe("/settings/people");
  });
});

describe("the Settings rail, for each role", () => {
  const keys = (role: "admin" | "member"): SettingsSection[] =>
    settingsSectionsFor(role).map((s) => s.key);

  it("shows an admin every section, People in Team's place", () => {
    expect(keys("admin")).toEqual([
      "workspace",
      "people",
      "integrations",
      "usage",
      "sharing",
      "account",
      "advanced",
    ]);
  });

  it("shows a member Account alone", () => {
    expect(keys("member")).toEqual(["account"]);
  });
});
