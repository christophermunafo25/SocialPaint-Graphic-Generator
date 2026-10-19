import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The gate's controller against a fake Supabase client (PHASE-8B): the calls
// it makes, Enter, the rules on submit, errors under their fields, the email
// kept between views, and the reset flow.
const auth = {
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
};

vi.mock("@/lib/stores/supabase/client", () => ({ supabase: () => ({ auth }) }));
vi.mock("@/lib/monitoring", () => ({ captureError: vi.fn() }));
const endRecovery = vi.fn();
vi.mock("@/lib/auth/recovery", () => ({ endRecovery: () => endRecovery() }));

const { AuthPage } = await import("./AuthPage");

beforeEach(() => {
  for (const fn of Object.values(auth)) fn.mockReset();
  endRecovery.mockReset();
  auth.signInWithPassword.mockResolvedValue({ error: null });
  auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
  auth.resetPasswordForEmail.mockResolvedValue({ error: null });
  auth.updateUser.mockResolvedValue({ error: null });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

const emailBox = () => screen.getByLabelText(/^email$/i);
const passwordBox = () => screen.getByLabelText(/password/i);

describe("AuthPage", () => {
  it("signs in with Enter", async () => {
    const user = userEvent.setup();
    render(<AuthPage />);
    expect(screen.getByRole("heading", { name: "Let’s get painting" })).toBeTruthy();
    await user.type(emailBox(), "pat@example.com");
    await user.type(passwordBox(), "correct horse{Enter}");
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: "pat@example.com",
      password: "correct horse",
    });
  });

  it("runs the rules on submit and focuses the first field in error", async () => {
    const user = userEvent.setup();
    render(<AuthPage />);
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
    expect(screen.getByText("Enter your email.")).toBeTruthy();
    expect(screen.getByText("Enter your password.")).toBeTruthy();
    expect(document.activeElement).toBe(emailBox());
    expect(emailBox().getAttribute("aria-invalid")).toBe("true");
    await user.type(emailBox(), "p");
    expect(screen.queryByText("Enter your email.")).toBeNull();
  });

  it("puts a wrong password under the password, in our words", async () => {
    auth.signInWithPassword.mockResolvedValue({
      error: { code: "invalid_credentials", message: "Invalid login credentials" },
    });
    const user = userEvent.setup();
    render(<AuthPage />);
    await user.type(emailBox(), "pat@example.com");
    await user.type(passwordBox(), "wrong{Enter}");
    expect(await screen.findByText("That email and password don’t match.")).toBeTruthy();
    expect(screen.queryByText("Invalid login credentials")).toBeNull();
  });

  it("keeps the email when switching to sign up, and signs up", async () => {
    const user = userEvent.setup();
    render(<AuthPage />);
    await user.type(emailBox(), "pat@example.com");
    await user.click(screen.getByRole("button", { name: "Sign up" }));
    expect(screen.getByRole("heading", { name: "Create your account" })).toBeTruthy();
    expect((emailBox() as HTMLInputElement).value).toBe("pat@example.com");
    await user.type(passwordBox(), "short{Enter}");
    expect(screen.getByText("Use at least 8 characters.")).toBeTruthy();
    expect(auth.signUp).not.toHaveBeenCalled();
    await user.type(passwordBox(), "enough{Enter}");
    expect(auth.signUp).toHaveBeenCalledWith({ email: "pat@example.com", password: "shortenough" });
    expect(await screen.findByRole("heading", { name: "Check your email" })).toBeTruthy();
    expect(screen.getByText("pat@example.com")).toBeTruthy();
  });

  it("sends a reset link and shows Reset link sent", async () => {
    const user = userEvent.setup();
    render(<AuthPage />);
    await user.type(emailBox(), "pat@example.com");
    await user.click(screen.getByRole("button", { name: "Forgot password?" }));
    await user.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith("pat@example.com", {
      redirectTo: window.location.origin,
    });
    expect(await screen.findByText(/We sent a reset link to/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Back to sign in" }));
    expect(screen.getByRole("heading", { name: "Let’s get painting" })).toBeTruthy();
  });

  it("saves the new password and ends the reset", async () => {
    const user = userEvent.setup();
    render(<AuthPage initialView="setPassword" />);
    expect(screen.getByRole("heading", { name: "Choose a new password" })).toBeTruthy();
    await user.type(screen.getByLabelText("New password"), "newpassword{Enter}");
    expect(auth.updateUser).toHaveBeenCalledWith({ password: "newpassword" });
    await vi.waitFor(() => expect(endRecovery).toHaveBeenCalled());
  });
});
