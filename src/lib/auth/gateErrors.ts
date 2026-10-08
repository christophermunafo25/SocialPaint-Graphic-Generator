// The sign-in gate's rules and messages (PHASE-8B §9 D3, D4). Each message
// sits under the field it belongs to; Supabase's own text never reaches the
// screen.

export type GateView = "signin" | "signup" | "forgot" | "resetSent" | "checkEmail" | "setPassword";

export interface GateErrors {
  email?: string;
  password?: string;
}

export const MIN_PASSWORD = 8;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The rules that run on submit (D3): each view's fields, present and well
 * formed. Empty means the view can submit. */
export function validateGate(view: GateView, email: string, password: string): GateErrors {
  const errors: GateErrors = {};
  const usesEmail = view === "signin" || view === "signup" || view === "forgot";
  const usesPassword = view === "signin" || view === "signup" || view === "setPassword";
  if (usesEmail) {
    const value = email.trim();
    if (!value) errors.email = "Enter your email.";
    else if (!EMAIL.test(value)) errors.email = "Enter a valid email address.";
  }
  if (usesPassword) {
    if (!password) {
      errors.password = view === "signin" ? "Enter your password." : "Use at least 8 characters.";
    } else if (view !== "signin" && password.length < MIN_PASSWORD) {
      errors.password = "Use at least 8 characters.";
    }
  }
  return errors;
}

export const hasErrors = (errors: GateErrors): boolean => !!(errors.email || errors.password);

/** The field a view's "anything else" message goes under: its last field. */
const lastField = (view: GateView): keyof GateErrors => (view === "forgot" ? "email" : "password");

/** A Supabase auth error as the gate words it (D4). */
export function gateErrorFor(view: GateView, error: unknown): GateErrors {
  const e = error as { code?: string; status?: number; message?: string } | null;
  const code = e?.code;
  if (code === "invalid_credentials") return { password: "That email and password don’t match." };
  if (code === "email_not_confirmed") {
    return { email: "Confirm your email first. The link is in your inbox." };
  }
  if (code === "user_already_exists" || code === "email_exists") {
    return { email: "That email already has an account. Sign in instead." };
  }
  if (code === "email_address_invalid") return { email: "Enter a valid email address." };
  if (code === "weak_password") return { password: "Use at least 8 characters." };
  if (
    code === "over_request_rate_limit" ||
    code === "over_email_send_rate_limit" ||
    e?.status === 429
  ) {
    return { [lastField(view)]: "Too many tries. Wait a minute, then try again." };
  }
  return { [lastField(view)]: "Something went wrong. Try again." };
}
