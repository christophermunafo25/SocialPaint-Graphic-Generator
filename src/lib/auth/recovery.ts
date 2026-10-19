// A password reset in progress. The recovery link signs the person in, so
// without this the app would open behind them and New password would never
// show (it never did before Phase 8b). App keeps the gate on New password
// while this is set; saving the password clears it and the app opens
// (PHASE-8B §9 D5).

import { useSyncExternalStore } from "react";

let recovering =
  typeof window !== "undefined" && /(^|[#&?])type=recovery(&|$)/.test(window.location.hash);
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

/** Supabase fired PASSWORD_RECOVERY. */
export function beginRecovery(): void {
  if (recovering) return;
  recovering = true;
  emit();
}

/** The new password is saved (or the person left the flow). */
export function endRecovery(): void {
  if (!recovering) return;
  recovering = false;
  emit();
}

export function useRecovering(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => recovering,
    () => false,
  );
}
