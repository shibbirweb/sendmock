import { describe, expect, test } from "vitest";

/** Every source file as text, collected at build time by Vite. */
const sourceFilesByPath = import.meta.glob<string>("/src/**/*.{ts,tsx}", {
  query: "?raw",
  import: "default",
  eager: true,
});

const staticMockImportPattern = /^\s*import\s[^;]*from\s+["']@\/mocks\//m;

describe("architecture rules", () => {
  test("UI-02.4 app code never imports the mock layer statically", () => {
    const filesImportingMocks = Object.entries(sourceFilesByPath)
      .filter(([filePath]) => !filePath.startsWith("/src/mocks/"))
      .filter(([, fileContent]) => staticMockImportPattern.test(fileContent))
      .map(([filePath]) => filePath);

    expect(filesImportingMocks).toEqual([]);
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
