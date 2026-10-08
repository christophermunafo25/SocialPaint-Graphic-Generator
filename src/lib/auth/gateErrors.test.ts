import { describe, expect, it } from "vitest";
import { gateErrorFor, hasErrors, validateGate } from "./gateErrors";

describe("validateGate", () => {
  it("asks for both fields on sign in, and only presence", () => {
    expect(validateGate("signin", "", "")).toEqual({
      email: "Enter your email.",
      password: "Enter your password.",
    });
    expect(validateGate("signin", "pat@example.com", "short")).toEqual({});
  });

  it("checks the address's form", () => {
    expect(validateGate("forgot", "pat@", "").email).toBe("Enter a valid email address.");
    expect(validateGate("forgot", " pat@example.com ", "")).toEqual({});
  });

  it("holds new passwords to 8 characters", () => {
    expect(validateGate("signup", "pat@example.com", "1234567").password).toBe(
      "Use at least 8 characters.",
    );
    expect(validateGate("setPassword", "", "12345678")).toEqual({});
    expect(hasErrors(validateGate("setPassword", "", ""))).toBe(true);
  });
});

describe("gateErrorFor", () => {
  it("words the cases the frames draw and the ones they don't", () => {
    expect(gateErrorFor("signin", { code: "invalid_credentials" })).toEqual({
      password: "That email and password don’t match.",
    });
    expect(gateErrorFor("signup", { code: "user_already_exists" }).email).toMatch(/Sign in/);
    expect(gateErrorFor("signin", { code: "email_not_confirmed" }).email).toMatch(/Confirm/);
  });

  it("puts rate limits and the unknown under the view's last field", () => {
    expect(gateErrorFor("forgot", { status: 429 })).toEqual({
      email: "Too many tries. Wait a minute, then try again.",
    });
    expect(gateErrorFor("signin", new Error("fetch failed"))).toEqual({
      password: "Something went wrong. Try again.",
    });
  });
});
