import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { OnboardingFlow } from "./OnboardingFlow";
import type { OnboardingServices } from "./services";

vi.mock("@/lib/render/fonts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/render/fonts")>()),
  loadGoogleFonts: vi.fn(),
}));

function fakeServices(overrides: Partial<OnboardingServices> = {}): OnboardingServices {
  return {
    pullAvailable: false,
    pullBrand: vi.fn(),
    savePerson: vi.fn(async () => {}),
    createWorkspace: vi.fn(async (draft) => ({
      companyId: "c1",
      companyName: draft.name,
      kit: { id: "k1", companyId: "c1", colors: [], typeStyles: [], guidelines: [] },
    })),
    updateBrand: vi.fn(),
    invite: vi.fn(async () => {}),
    listStarters: vi.fn(async () => []),
    enter: vi.fn(async () => {}),
    leave: vi.fn(),
    ...overrides,
  };
}

const heading = () => screen.getByRole("heading", { level: 1 }).textContent;

describe("OnboardingFlow", () => {
  it("asks for what each step requires, then walks to the workspace", async () => {
    const user = userEvent.setup();
    const services = fakeServices();
    render(<OnboardingFlow services={services} />);

    expect(heading()).toBe("Let’s get to know you");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText("Enter your name.")).toBeTruthy();
    expect(screen.getByText("Choose one.")).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText("What is your name?"));

    await user.type(screen.getByLabelText("What is your name?"), "Jordan Lee");
    await user.click(screen.getByRole("radio", { name: "Marketing" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(heading()).toBe("Who are you setting SocialPaint up for?");
    await user.click(screen.getByRole("radio", { name: /My company/ }));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(heading()).toBe("Tell us about your team");
    await user.type(screen.getByLabelText("What is your company called?"), "Acme Studios");
    await user.click(screen.getByRole("radio", { name: "11–50" }));
    await user.click(screen.getByRole("checkbox", { name: "Clients" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(heading()).toBe("What do you want to make first?");
    await user.click(screen.getByRole("checkbox", { name: "Hiring posts" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(heading()).toBe("Where can we find your brand?");
    await user.click(screen.getByRole("button", { name: "I don’t have a website" }));
    expect(heading()).toBe("Add your brand");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(heading()).toBe("Does this look like your brand?");
    await user.click(screen.getByRole("button", { name: "Looks good" }));
    expect(
      await screen.findByRole("heading", { name: "Who else should join Acme Studios?" }),
    ).toBeTruthy();

    const draft = vi.mocked(services.createWorkspace).mock.calls[0][0];
    expect(draft.name).toBe("Acme Studios");
    expect(draft.website).toBeUndefined();
    expect(draft.profile).toMatchObject({
      setupFor: "company",
      teamSize: "11_50",
      makers: ["clients"],
      firstUp: ["hiring"],
    });
    expect(services.savePerson).toHaveBeenCalledWith({ name: "Jordan Lee", role: "marketing" });

    await user.click(screen.getByRole("button", { name: "Skip for now" }));
    expect(heading()).toBe("Your workspace is ready, Jordan");
    await user.click(screen.getByRole("button", { name: "Go to my templates" }));
    expect(services.enter).toHaveBeenCalledWith("c1", { name: "portal" });
  });

  it("sends invites per row and keeps a failed one with its message", async () => {
    const user = userEvent.setup();
    const invite = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("nope"));
    const services = fakeServices({ invite });
    render(
      <OnboardingFlow
        services={services}
        initial={{
          step: "invite",
          answers: { companyName: "Acme Studios" },
          created: {
            companyId: "c1",
            companyName: "Acme Studios",
            kit: { id: "k1", companyId: "c1", colors: [], typeStyles: [], guidelines: [] },
          },
        }}
      />,
    );
    await user.type(screen.getByLabelText("Email 1", { exact: true }), "pat@acme.example");
    await user.click(screen.getByRole("button", { name: "Add another" }));
    await user.type(screen.getByLabelText("Email 2", { exact: true }), "sam@acme.example");
    await user.click(screen.getByRole("button", { name: "Send invites" }));
    expect(invite).toHaveBeenNthCalledWith(1, "c1", "pat@acme.example", "member");
    expect(await screen.findByText(/That invite didn’t go/)).toBeTruthy();
    expect(screen.getByDisplayValue("sam@acme.example")).toBeTruthy();
    expect(screen.queryByDisplayValue("pat@acme.example")).toBeNull();
  });

  it("starts the in-app path at Your team, with Cancel", async () => {
    const user = userEvent.setup();
    const services = fakeServices();
    render(<OnboardingFlow services={services} inApp />);
    expect(heading()).toBe("Tell us about the new company");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(services.leave).toHaveBeenCalled();
  });
});
