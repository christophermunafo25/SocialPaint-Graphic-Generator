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
      "supabase",
      "scripts",
      // Claude Code config and the worktrees other sessions keep under it.
      ".claude",
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
      // Chrome reads tokens and the .t-* text classes (CLAUDE.md, ElevenLabs
      // RULES.md): no raw hex and no inline type in a style prop.
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXAttribute[name.name='style'] Literal[value=/^#[0-9a-fA-F]{3,8}$/]",
          message: "No raw hex in a style prop: read a semantic token.",
        },
        {
          selector:
            "JSXAttribute[name.name='style'] Property[key.name=/^(fontSize|fontWeight|fontFamily|lineHeight|letterSpacing)$/]",
          message: "No inline type in a style prop: use a .t-* text class.",
        },
      ],
    },
  },
  {
    // Template content, not chrome: these draw a tenant's own type and
    // colors, so inline type is how they work.
    files: [
      "src/app/components/SchemaRenderer.tsx",
      "src/app/components/builder/FieldOverlayEditor.tsx",
      "src/app/components/onboarding/OnboardingFlow.tsx",
    ],
    rules: { "no-restricted-syntax": "off" },
  },
  {
    // Still on inline type from before the new brand (ElevenLabs E9). Remove
    // a file from this list when it moves onto the .t-* classes, and never
    // add one.
    files: [
      "src/app/App.tsx",
      "src/app/components/ColorControl.tsx",
      "src/app/components/ConfigFailureScreen.tsx",
      "src/app/components/DevBackendBanner.tsx",
      "src/app/components/ErrorBoundary.tsx",
      "src/app/components/ImageSourceChooser.tsx",
      "src/app/components/TemplateThumbnail.tsx",
      "src/app/components/builder/BackgroundReflowDialog.tsx",
      "src/app/components/builder/CanvasSizePicker.tsx",
      "src/app/components/builder/FieldContextMenu.tsx",
      "src/app/components/builder/FillPicker.tsx",
      "src/app/components/builder/ShortcutsPanel.tsx",
      "src/app/public/PublicLinkUnavailable.tsx",
    ],
    rules: { "no-restricted-syntax": "off" },
  },
);
