import React from "react";
import { ColorSchemeProvider } from "@/lib/colorScheme";
import { ErrorBoundary, RootCrashScreen } from "../components/ErrorBoundary";
import { PublicFillPage } from "./PublicFillPage";

/** The public entry point.
 *
 * Note what is NOT here: no AuthProvider, no BrandProvider, no
 * RouterProvider, no AppShell, no store factory. main.tsx branches to this
 * module instead of ./app/App, so an anonymous visitor never loads the
 * authenticated half of the application at all — the auth gate in App.tsx is
 * not bypassed, it simply never runs.
 *
 * ColorSchemeProvider stays because the page still has to respect the
 * visitor's light/dark preference. It reads localStorage and a media query,
 * and knows nothing about any tenant: the customer's brand kit styles the
 * GRAPHIC, never this chrome. */
export default function PublicApp({ token }: { token: string }) {
  return (
    <ErrorBoundary level="root" fallback={() => <RootCrashScreen />}>
      <ColorSchemeProvider>
        <PublicFillPage token={token} />
      </ColorSchemeProvider>
    </ErrorBoundary>
  );
}
