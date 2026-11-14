import { describe, expect, test } from "vitest";

/** Every source file as text, collected at build time by Vite. */
const sourceFilesByPath = import.meta.glob<string>("/src/**/*.{ts,tsx}", {
  query: "?raw",
  import: "default",
  eager: true,
});

const staticMockImportPattern = /^\s*import\s[^;]*from\s+["']@\/mocks\//m;

const apiModeReadPattern = /VITE_API_MODE|@\/config\/api-mode/;

// Switching to live changes only how the app starts and two labels; no screen branches on the mode.
const filesAllowedToReadApiMode = [
  "/src/components/layout/app-header.tsx",
  "/src/config/api-mode.ts",
  "/src/features/connection/connection-status.tsx",
  "/src/main.tsx",
];

describe("architecture rules", () => {
  test("UI-02.4 app code never imports the mock layer statically", () => {
    const filesImportingMocks = Object.entries(sourceFilesByPath)
      .filter(([filePath]) => !filePath.startsWith("/src/mocks/"))
      .filter(([, fileContent]) => staticMockImportPattern.test(fileContent))
      .map(([filePath]) => filePath);

    expect(filesImportingMocks).toEqual([]);
  });

  test("UI-02.5 only the start-up, the dev toolbar button and the connection label read the API mode", () => {
    const filesReadingApiMode = Object.entries(sourceFilesByPath)
      .filter(([filePath]) => !filePath.startsWith("/src/mocks/"))
      .filter(([filePath]) => !/\.test\.tsx?$/.test(filePath))
      .filter(([, fileContent]) => apiModeReadPattern.test(fileContent))
      .map(([filePath]) => filePath)
      .sort();

    expect(filesReadingApiMode).toEqual(filesAllowedToReadApiMode);
  });

  test("no hand-written source file is over the 500 line hard limit", () => {
    const oversizedFiles = Object.entries(sourceFilesByPath)
      .filter(([filePath]) => !filePath.startsWith("/src/components/ui/"))
      .filter(([filePath]) => filePath !== "/src/routeTree.gen.ts")
      .filter(([, fileContent]) => fileContent.split("\n").length > 500)
      .map(([filePath]) => filePath);

    expect(oversizedFiles).toEqual([]);
  });
});
