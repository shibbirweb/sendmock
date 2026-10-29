import { interpolate, useCurrentFrame } from "remotion";

import { trailerPalette } from "../trailer-palette";

export type FlowDirection = "toApp" | "fromApp";

type FlowLineProps = {
  startXPx: number;
  endXPx: number;
  yPx: number;
  direction: FlowDirection;
  /** Frames at which a request starts to travel along the line. */
  travelStartFrames: number[];
  travelDurationFrames: number;
};

/**
 * The motif: a dashed mint line between SendMock and your app. Each request
 * travels as a soft dot of light and lands in a soft bloom (never a ring).
 */
export function FlowLine({
  startXPx,
  endXPx,
  yPx,
  direction,
  travelStartFrames,
  travelDurationFrames,
}: FlowLineProps) {
  const frame = useCurrentFrame();
  const fromXPx = direction === "toApp" ? startXPx : endXPx;
  const toXPx = direction === "toApp" ? endXPx : startXPx;
  const dashFlowPx = (direction === "toApp" ? -1 : 1) * frame * 1.4;
  const lineOpacity = interpolate(frame, [0, 14], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <svg
      width={1920}
      height={1080}
      style={{ position: "absolute", inset: 0, overflow: "visible" }}
    >
      <defs>
        <radialGradient id="flow-light">
          <stop offset="0" stopColor={trailerPalette.accent} stopOpacity="1" />
          <stop offset="1" stopColor={trailerPalette.accent} stopOpacity="0" />
        </radialGradient>
      </defs>
      <line
        x1={startXPx}
        x2={endXPx}
        y1={yPx}
        y2={yPx}
        stroke={trailerPalette.accent}
        strokeOpacity={0.55 * lineOpacity}
        strokeWidth={3}
        strokeDasharray="10 12"
        strokeDashoffset={dashFlowPx}
        strokeLinecap="round"
      />
      {travelStartFrames.map((travelStartFrame) => {
        const travelProgress = interpolate(
          frame,
          [travelStartFrame, travelStartFrame + travelDurationFrames],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );
        const isTravelling = travelProgress > 0 && travelProgress < 1;
        const bloomOpacity = interpolate(
          frame,
          [
            travelStartFrame + travelDurationFrames - 2,
            travelStartFrame + travelDurationFrames + 4,
            travelStartFrame + travelDurationFrames + 26,
          ],
          [0, 0.7, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );
        const dotXPx = fromXPx + (toXPx - fromXPx) * travelProgress;
        return (
          <g key={travelStartFrame}>
            {isTravelling ? (
              <circle cx={dotXPx} cy={yPx} r={26} fill="url(#flow-light)" />
            ) : null}
            <circle
              cx={toXPx}
              cy={yPx}
              r={70}
              fill="url(#flow-light)"
              opacity={bloomOpacity * 0.6}
            />
          </g>
        );
      })}
    </svg>
  );
}
