import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigate = vi.fn();
let routeName = "dashboard";
vi.mock("../router", () => ({
  useRouter: () => ({ route: { name: routeName }, navigate }),
}));
vi.mock("@/lib/auth/AuthContext", () => ({
  useAuth: () => ({
    role: "admin",
    user: { email: "jo.doe@example.com" },
    company: { name: "Example" },
  }),
}));
vi.mock("@/lib/colorScheme", () => ({
  useColorScheme: () => ({ resolved: "light", setScheme: () => {} }),
}));
let collapsed = false;
const setSidebarCollapsed = vi.fn();
vi.mock("./layout/ChromeContext", () => ({
  useChrome: () => ({ sidebarCollapsed: collapsed, setSidebarCollapsed }),
}));

import { Sidebar } from "./Sidebar";

describe("Sidebar", () => {
  beforeEach(() => {
    navigate.mockClear();
    collapsed = false;
    routeName = "dashboard";
    // The desktop rail: the window is wider than 1023.
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;
  });

  it("puts the theme toggle beside Collapse in the open header", () => {
    render(<Sidebar />);
    const toggle = screen.getByRole("button", { name: "Switch to dark mode" });
    const collapse = screen.getByRole("button", { name: "Collapse sidebar" });
    expect(toggle.parentElement).toBe(collapse.parentElement);
    expect(screen.getByRole("button", { name: "SocialPaint home" })).toBeTruthy();
  });

  it("shows the account's name and email beside Settings when open", () => {
    render(<Sidebar />);
    expect(screen.getByText("Jo Doe")).toBeTruthy();
    expect(screen.getByText("jo.doe@example.com")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(navigate).toHaveBeenCalledWith({ name: "settings" });
  });

  it("collapsed, draws Expand alone and makes the avatar the Settings button", () => {
    collapsed = true;
    routeName = "settings";
    render(<Sidebar />);
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Switch to dark mode" })).toBeNull();
    expect(screen.queryByRole("button", { name: "SocialPaint home" })).toBeNull();
    expect(screen.queryByText("jo.doe@example.com")).toBeNull();
    const settings = screen.getByRole("button", { name: "Settings" });
    expect(settings.getAttribute("aria-current")).toBe("page");
    expect(settings.querySelector(".ui-avatar")).not.toBeNull();
    fireEvent.click(settings);
    expect(navigate).toHaveBeenCalledWith({ name: "settings" });
  });

  it("keeps every area in the nav, open and collapsed", () => {
    const names = [
      "Brand Templates",
      "Generate",
      "Template Builder",
      "Insights & Analytics",
      "Brand Studio",
    ];
    const { unmount } = render(<Sidebar />);
    for (const name of names) expect(screen.getByRole("button", { name })).toBeTruthy();
    unmount();
    collapsed = true;
    render(<Sidebar />);
    for (const name of names) expect(screen.getByRole("button", { name })).toBeTruthy();
  });
});
