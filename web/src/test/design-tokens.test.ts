import { describe, expect, test } from "vitest";

/** Every source file as text, keyed by its path from `src/` (Vite reads them). */
const sourceFiles = import.meta.glob<string>(
  ["../**/*.{ts,tsx}", "!../**/*.test.{ts,tsx}", "!../mocks/**"],
  { query: "?raw", import: "default", eager: true },
);

/**
 * Where a raw colour is allowed: the vendored shadcn components (overlay
 * scrims, slider thumb) and the email preview, which renders mail on white
 * like a mail client does.
 */
const allowedPaths = [
  "components/ui/",
  "features/mail/detail/preview/email-html-preview.tsx",
];

const paletteNames =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const colourUtilities =
  "bg|text|border|ring|fill|stroke|from|to|via|outline|divide|shadow|accent|caret|decoration|placeholder";
const rawColourPatterns = [
  new RegExp(`\\b(?:${colourUtilities})-(?:${paletteNames})-\\d{2,3}\\b`),
  /\b(?:bg|text|border|ring|fill|stroke)-(?:white|black)\b/,
  /\b(?:bg|text|border|ring|fill|stroke)-\[#[0-9a-f]{3,8}\]/i,
];

describe("design tokens", () => {
  test("UI-07.1 class names use design tokens, not Tailwind palette colours or hex values", () => {
    const rawColourUses = Object.entries(sourceFiles).flatMap(
      ([filePath, fileText]) => {
        const relativePath = filePath.replace(/^\.\.\//, "");
        if (
          allowedPaths.some((allowedPath) =>
            relativePath.startsWith(allowedPath),
          )
        ) {
          return [];
        }

        return fileText
          .split("\n")
          .flatMap((lineText, lineIndex) =>
            rawColourPatterns.some((rawColourPattern) =>
              rawColourPattern.test(lineText),
            )
              ? [`${relativePath}:${lineIndex + 1}: ${lineText.trim()}`]
              : [],
          );
      },
    );

    expect(Object.keys(sourceFiles).length).toBeGreaterThan(100);
    expect(rawColourUses).toEqual([]);
  });
});
