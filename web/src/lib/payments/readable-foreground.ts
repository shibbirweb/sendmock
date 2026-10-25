/** Relative luminance of a `#rrggbb` colour (WCAG). */
function readLuminance(hexColor: string): number {
  const channels = [1, 3, 5].map((channelStart) => {
    const channelValue =
      Number.parseInt(hexColor.slice(channelStart, channelStart + 2), 16) / 255;
    return channelValue <= 0.03928
      ? channelValue / 12.92
      : ((channelValue + 0.055) / 1.055) ** 2.4;
  });

  return (
    0.2126 * (channels[0] ?? 0) +
    0.7152 * (channels[1] ?? 0) +
    0.0722 * (channels[2] ?? 0)
  );
}

/**
 * Near-black or white text, whichever contrasts more with a configured
 * accent, so any gateway colour keeps a readable button.
 */
export function readReadableForeground(hexColor: string): string {
  if (!/^#[0-9a-f]{6}$/i.test(hexColor)) {
    return "#ffffff";
  }
  const accentLuminance = readLuminance(hexColor);
  const contrastWithWhite = 1.05 / (accentLuminance + 0.05);
  const contrastWithBlack = (accentLuminance + 0.05) / 0.05;

  return contrastWithBlack > contrastWithWhite ? "#111111" : "#ffffff";
}
