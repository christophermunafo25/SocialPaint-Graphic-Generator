import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/** Unit tests only — the search index is pure and needs no DOM. The `@`
 *  alias mirrors tsconfig so test files import exactly as app code does. */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "supabase/functions/_shared/*.test.ts"],
  },
});
