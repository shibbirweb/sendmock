import { interpolate } from "remotion";

import { fontFamily } from "../../brand";
import { trailerPalette } from "../trailer-palette";
import { installCommands } from "../trailer-facts";
import { platformTiles } from "./platforms/platforms-scene";

/** The command the platforms scene leaves in the bar at the cut. */
const lastInstallCommand = installCommands[installCommands.length - 1] ?? "";

/** The platforms the closing bar names, in the owner's order. */
const closingPlatformNames = ["Windows", "macOS", "Linux", "Docker"];

const closingPlatforms = closingPlatformNames.flatMap((platformName) =>
  platformTiles.filter((platformTile) => platformTile.name === platformName),
);

type ClosingPlatformsBarProps = {
  /** 0 while the bar still shows the install command, 1 once it has settled. */
  morphProgress: number;
};

/**
 * The closing bar's contents: the last install command from the platforms
 * scene fades into every platform SendMock runs on.
 */
export function ClosingPlatformsBar({
  morphProgress,
}: ClosingPlatformsBarProps) {
  const commandOpacity = interpolate(morphProgress, [0, 0.5], [1, 0], {
    extrapolateRight: "clamp",
  });
  const platformsOpacity = interpolate(morphProgress, [0.5, 1], [0, 1], {
    extrapolateLeft: "clamp",
  });

  return (
    <>
      <span style={{ opacity: commandOpacity }}>
        <span style={{ color: trailerPalette.accent }}>$ </span>
        {lastInstallCommand}
      </span>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 40,
          opacity: platformsOpacity,
          fontFamily,
          fontSize: 30,
          fontWeight: 500,
          color: trailerPalette.text,
        }}
      >
        {closingPlatforms.map(({ name, Icon }) => (
          <span
            key={name}
            style={{ display: "flex", alignItems: "center", gap: 12 }}
          >
            <Icon size={30} color={trailerPalette.accent} strokeWidth={1.75} />
            {name}
          </span>
        ))}
      </div>
    </>
  );
}
