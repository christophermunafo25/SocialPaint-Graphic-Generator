import { defineConfig } from "vite";
import path from "path";
import { execSync } from "child_process";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { sentryVitePlugin } from "@sentry/vite-plugin";

function figmaAssetResolver() {
  return {
    name: "figma-asset-resolver",
    resolveId(id) {
      if (id.startsWith("figma:asset/")) {
        const filename = id.replace("figma:asset/", "");
        return path.resolve(__dirname, "src/assets", filename);
      }
    },
  };
}

// Release identity: the git SHA, shared by the client SDK (Sentry.init
// release) and the source-map upload so stack traces resolve against the
// right build. Failing to read it must never fail the build.
function gitRelease(): string | undefined {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return undefined;
  }
}

// Source-map upload is opt-in via build-time secrets (never shipped to the
// client). Without them the plugin stays out of the build entirely —
// monitoring must not become a second failure mode, build included.
const sentryUploadEnabled = Boolean(
  process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT,
);
const release = gitRelease();

export default defineConfig({
  // Honor the harness-assigned port (autoPort) so multiple sessions can run
  // their own dev servers side by side; falls back to Vite's default.
  server: process.env.PORT ? { port: Number(process.env.PORT), strictPort: true } : undefined,
  define: {
    "import.meta.env.VITE_APP_RELEASE": JSON.stringify(release ?? ""),
  },
  build: {
    // Maps are generated for the Sentry upload, then deleted from dist by
    // the plugin — they never deploy. Without the upload configured they are
    // simply not emitted.
    sourcemap: sentryUploadEnabled ? "hidden" : false,
  },
  plugins: [
    figmaAssetResolver(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
    sentryUploadEnabled &&
      sentryVitePlugin({
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        authToken: process.env.SENTRY_AUTH_TOKEN,
        release: release ? { name: release } : undefined,
        sourcemaps: { filesToDeleteAfterUpload: ["dist/**/*.map"] },
        telemetry: false,
      }),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
