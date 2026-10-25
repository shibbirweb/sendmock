import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

import { rawColourPatternSources } from "./src/lib/design/raw-colour-patterns.ts";

export default defineConfig([
  // Generated code: shadcn components and the TanStack route tree.
  globalIgnores([
    "dist",
    "coverage",
    "playwright-report",
    "test-results",
    "src/components/ui",
    "src/routeTree.gen.ts",
    "public/mockServiceWorker.js",
  ]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      "react-refresh/only-export-components": "off",
      // AGENTS.md: full block syntax for every if.
      curly: ["error", "all"],
      // AGENTS.md: 500 lines per file is the hard limit (300 is the target).
      "max-lines": [
        "error",
        { max: 500, skipBlankLines: true, skipComments: true },
      ],
      // AGENTS.md: functions about 50 lines, components about 200; this is the ceiling.
      "max-lines-per-function": [
        "error",
        { max: 200, skipBlankLines: true, skipComments: true },
      ],
    },
  },
  {
    // UI-02.4: app code reaches the mock API only through HTTP, never by import.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/mocks/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/mocks/*", "@/mocks/**"],
              message:
                "Use the API client and query hooks; the mock layer is loaded only through dynamic import in mock mode.",
            },
          ],
        },
      ],
    },
  },
  {
    // UI-07.1: colours come from the design tokens. The email preview renders
    // mail on white, as a mail client does; the mock layer holds data colours.
    files: ["src/**/*.{ts,tsx}"],
    ignores: [
      "src/mocks/**",
      "src/**/*.test.{ts,tsx}",
      "src/features/mail/detail/preview/email-html-preview.tsx",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...rawColourPatternSources.flatMap((patternSource) => [
          {
            selector: `Literal[value=/${patternSource}/]`,
            message:
              "Use a design token (text-destructive, bg-success, ...) instead of a raw colour class.",
          },
          {
            selector: `TemplateElement[value.raw=/${patternSource}/]`,
            message:
              "Use a design token (text-destructive, bg-success, ...) instead of a raw colour class.",
          },
        ]),
      ],
    },
  },
  {
    files: ["**/*.test.{ts,tsx}", "tests/**/*.ts"],
    rules: {
      "max-lines-per-function": "off",
    },
  },
]);
