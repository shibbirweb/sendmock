/**
 * A square changing level fades through the shades in between. Its level is a fraction (2.4 on
 * its way from 2 to 3), rounded to one of `shadesPerLevel` steps, and each step's colour is
 * mixed once per draw, so squares are still filled in batches of one colour.
 */
export const shadesPerLevel = 8;

export type RgbColor = [number, number, number];

/** Parses `#rgb` or `#rrggbb`; anything else is null, so the caller falls back to a level colour. */
export function parseHexColor(colorValue: string): RgbColor | null {
  const hexDigits = colorValue.trim().replace(/^#/, "");
  if (!/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hexDigits)) {
    return null;
  }
  const fullHexDigits =
    hexDigits.length === 3
      ? hexDigits
          .split("")
          .map((digit) => digit + digit)
          .join("")
      : hexDigits;
  return [
    parseInt(fullHexDigits.slice(0, 2), 16),
    parseInt(fullHexDigits.slice(2, 4), 16),
    parseInt(fullHexDigits.slice(4, 6), 16),
  ];
}

/** The colour `amount` of the way from `fromColor` (0) to `toColor` (1). */
export function mixColors(
  fromColor: RgbColor,
  toColor: RgbColor,
  amount: number,
): string {
  const channels = fromColor.map((channel, channelIndex) =>
    Math.round(channel + ((toColor[channelIndex] ?? 0) - channel) * amount),
  );
  return `rgb(${channels.join(" ")})`;
}

/** Every shade from the first level colour to the last, indexed by `findShadeIndex`. */
export function buildShadeColors(levelColors: readonly string[]): string[] {
  const parsedColors = levelColors.map(parseHexColor);
  const shadeCount = (levelColors.length - 1) * shadesPerLevel + 1;
  return Array.from({ length: shadeCount }, (_, shadeIndex) => {
    const lowerLevel = Math.floor(shadeIndex / shadesPerLevel);
    const amount = (shadeIndex % shadesPerLevel) / shadesPerLevel;
    const lowerColor = parsedColors[lowerLevel];
    const upperColor = parsedColors[lowerLevel + 1];
    if (amount === 0 || !lowerColor || !upperColor) {
      return levelColors[Math.round(shadeIndex / shadesPerLevel)] ?? "";
    }
    return mixColors(lowerColor, upperColor, amount);
  });
}

/** The shade index for a fractional level. */
export function findShadeIndex(displayedLevel: number): number {
  return Math.round(displayedLevel * shadesPerLevel);
}
