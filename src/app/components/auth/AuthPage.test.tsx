import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The gate's controller against a fake Supabase client: the calls it makes,
// Enter, the recovery event, and the email kept between views.
const auth = {
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
  onAuthStateChange: vi.fn(),
};
let authListener: ((event: string) => void) | null = null;

vi.mock("@/lib/stores/supabase/client", () => ({ supabase: () => ({ auth }) }));

const { AuthPage } = await import("./AuthPage");

beforeEach(() => {
  for (const fn of Object.values(auth)) fn.mockReset();
  auth.onAuthStateChange.mockImplementation((cb: (event: string) => void) => {
    authListener = cb;
    return { data: { subscription: { unsubscribe: () => {} } } };
  });
  auth.signInWithPassword.mockResolvedValue({ error: null });
  auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
  auth.resetPasswordForEmail.mockResolvedValue({ error: null });
  auth.updateUser.mockResolvedValue({ error: null });
});

const emailBox = () => screen.getByLabelText(/^email$/i);
const passwordBox = () => screen.getByLabelText(/password/i);

describe("AuthPage", () => {
  it("signs in with Enter", async () => {
    const user = userEvent.setup();
    render(<AuthPage />);
    await user.type(emailBox(), "pat@example.com");
    await user.type(passwordBox(), "correct horse{Enter}");
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: "pat@example.com",
      password: "correct horse",
    });
  });

  it("keeps the email when switching to sign up, and signs up", async () => {
    const user = userEvent.setup();
    render(<AuthPage />);
    await user.type(emailBox(), "pat@example.com");
    await user.click(screen.getByRole("button", { name: /^sign up$/i }));
    expect(screen.getByRole("heading", { name: /create your account/i })).toBeTruthy();
    expect((emailBox() as HTMLInputElement).value).toBe("pat@example.com");
    await user.type(passwordBox(), "longenough{Enter}");
    expect(auth.signUp).toHaveBeenCalledWith({ email: "pat@example.com", password: "longenough" });
    expect(await screen.findByRole("heading", { name: /check your email/i })).toBeTruthy();
  });

  it("sends a reset link to the typed address", async () => {
    const user = userEvent.setup();
    render(<AuthPage />);
    await user.type(emailBox(), "pat@example.com");
    await user.click(screen.getByRole("button", { name: /forgot password/i }));
    await user.click(screen.getByRole("button", { name: /send reset link/i }));
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith("pat@example.com", {
      redirectTo: window.location.origin,
    });
  });

  it("opens New password on the recovery event and saves it", async () => {
    const user = userEvent.setup();
    render(<AuthPage />);
    act(() => authListener?.("PASSWORD_RECOVERY"));
    expect(screen.getByRole("heading", { name: /choose a new password/i })).toBeTruthy();
    await user.type(screen.getByLabelText(/new password/i), "newpassword{Enter}");
    expect(auth.updateUser).toHaveBeenCalledWith({ password: "newpassword" });
  });
});
