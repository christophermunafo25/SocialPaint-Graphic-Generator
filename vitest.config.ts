import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/** Two projects. `unit` runs the pure tests (`*.test.ts`) in node, as every
 *  test ran before the new look. `dom` runs component tests (`*.test.tsx`)
 *  in happy-dom, for the primitives in src/app/components/primitives. The
 *  `@` alias mirrors tsconfig so test files import exactly as app code
 *  does; both projects inherit it. */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts", "supabase/functions/_shared/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "dom",
          environment: "happy-dom",
          include: ["src/**/*.test.tsx"],
          setupFiles: ["src/test/setupDom.ts"],
        },
      },
    ],
  },
});
