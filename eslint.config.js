import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

/** Bug-catching rules only — no style opinions (Prettier owns style).
 * Scope mirrors tsconfig: src/ minus generated dirs. supabase/functions/
 * is Deno and is checked by `deno check` / `deno lint` instead. */
export default tseslint.config(
  {
    ignores: [
      "dist",
      "node_modules",
      "src/imports",
      "src/app/components/ui",
      "supabase",
      "scripts",
    ],
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      "react-hooks": reactHooks,
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
    },
  },
);
