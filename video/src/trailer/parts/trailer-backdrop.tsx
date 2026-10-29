import { AbsoluteFill, useCurrentFrame } from "remotion";

import { fontFaceCss } from "../../brand";
import { trailerPalette } from "../trailer-palette";

const grainSvg = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.5'/></svg>")`;

/** The dark canvas with two slowly drifting soft glows and fine grain. */
export function TrailerBackdrop() {
  const frame = useCurrentFrame();
  const driftRadians = frame / 260;
  const tealGlowX = 22 + Math.sin(driftRadians) * 6;
  const tealGlowY = 28 + Math.cos(driftRadians * 0.8) * 5;
  const emeraldGlowX = 78 + Math.cos(driftRadians * 0.9) * 6;
  const emeraldGlowY = 74 + Math.sin(driftRadians * 1.1) * 5;

  return (
    <AbsoluteFill style={{ backgroundColor: trailerPalette.canvas }}>
      <style>{fontFaceCss}</style>
      <AbsoluteFill
        style={{
          background: [
            `radial-gradient(42% 48% at ${tealGlowX}% ${tealGlowY}%, rgba(13, 148, 136, 0.20), transparent 70%)`,
            `radial-gradient(40% 46% at ${emeraldGlowX}% ${emeraldGlowY}%, rgba(16, 185, 129, 0.14), transparent 70%)`,
          ].join(", "),
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage: grainSvg,
          opacity: 0.06,
          mixBlendMode: "overlay",
        }}
      />
    </AbsoluteFill>
  );
}
