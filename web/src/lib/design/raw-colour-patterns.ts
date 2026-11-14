/**
 * Class names that bypass the design tokens (UI-07.1): Tailwind palette
 * colours, white or black, and hex colours. ESLint checks every source file
 * against these; data colours set through `style` are not class names.
 */
const paletteNames =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const colourUtilities =
  "bg|text|border|ring|fill|stroke|from|to|via|outline|divide|shadow|accent|caret|decoration|placeholder";

export const rawColourPatternSources = [
  `\\b(?:${colourUtilities})-(?:${paletteNames})-\\d{2,3}\\b`,
  "\\b(?:bg|text|border|ring|fill|stroke)-(?:white|black)\\b",
  "\\b(?:bg|text|border|ring|fill|stroke)-\\[#[0-9a-fA-F]{3,8}\\]",
];

/** Whether a piece of source text uses a raw colour class. */
export function hasRawColourClass(sourceText: string): boolean {
  return rawColourPatternSources.some((patternSource) =>
    new RegExp(patternSource).test(sourceText),
  );
}
