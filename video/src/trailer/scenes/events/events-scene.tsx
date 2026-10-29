import { AbsoluteFill, interpolate, random } from "remotion";

import { EventChip } from "../../parts/event-chip";
import { SceneHeadline } from "../../parts/scene-headline";
import type { UiCue } from "../../ui-cues";
import { eventGroups } from "../../trailer-facts";
import { getRiseInStyle } from "../../trailer-motion";
import { areaColors, trailerPalette } from "../../trailer-palette";
import { useDesignFrame } from "../../trailer-time";

export const eventsSceneDurationFrames = 270;

const allEvents = eventGroups.flatMap((eventGroup) =>
  eventGroup.eventNames.map((eventName) => ({
    eventName,
    color: areaColors[eventGroup.area],
  })),
);

const cascadeStartFrame = 24;
const cascadeStaggerFrames = 2;
const firingStartFrame =
  cascadeStartFrame + allEvents.length * cascadeStaggerFrames + 10;
const firingIntervalFrames = 5;
const litDurationFrames = 22;

/**
 * Sounds: a soft tick for every few chips as the wall cascades in, then a
 * soft low note for every third event that fires live.
 */
export const eventsSceneCues: UiCue[] = [
  ...allEvents
    .filter((_eventEntry, eventIndex) => eventIndex % 4 === 0)
    .map((_eventEntry, groupIndex): UiCue => ({
      frame: cascadeStartFrame + groupIndex * 4 * cascadeStaggerFrames,
      cueKind: "appear",
    })),
  ...Array.from(
    {
      length: Math.floor(
        (eventsSceneDurationFrames - firingStartFrame) /
          (firingIntervalFrames * 3),
      ),
    },
    (_unused, fireIndex): UiCue => ({
      frame: firingStartFrame + fireIndex * firingIntervalFrames * 3,
      cueKind: "fire",
    }),
  ),
];

/** How lit an event chip is from the live firing that follows the cascade. */
function getFiringLitAmount(frame: number, eventIndex: number): number {
  let litAmount = 0;
  for (
    let fireFrame = firingStartFrame;
    fireFrame <= frame;
    fireFrame += firingIntervalFrames
  ) {
    const firedIndex = Math.floor(
      random(`event-fire-${fireFrame}`) * allEvents.length,
    );
    if (firedIndex === eventIndex) {
      const fade = interpolate(
        frame,
        [fireFrame, fireFrame + 3, fireFrame + litDurationFrames],
        [0, 1, 0],
        {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        },
      );
      litAmount = Math.max(litAmount, fade);
    }
  }
  return litAmount;
}

/** Scene 7: every built-in event, cascading in, then firing live. */
export function EventsScene() {
  const frame = useDesignFrame();
  const totalEventCount = allEvents.length;

  return (
    <AbsoluteFill>
      <SceneHeadline
        chapterLabel="06 · Events"
        headline={`${totalEventCount} events. Subscribe to any.`}
      />
      <div
        style={{
          position: "absolute",
          left: 150,
          right: 150,
          top: 280,
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: 20,
        }}
      >
        {allEvents.map((eventEntry, eventIndex) => (
          <EventChip
            key={eventEntry.eventName}
            label={eventEntry.eventName}
            color={eventEntry.color}
            fontSizePx={25}
            litAmount={getFiringLitAmount(frame, eventIndex)}
            style={getRiseInStyle(
              frame,
              cascadeStartFrame + eventIndex * cascadeStaggerFrames,
              12,
              16,
            )}
          />
        ))}
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 110,
          display: "flex",
          justifyContent: "center",
          gap: 34,
          fontSize: 22,
          color: trailerPalette.textMuted,
        }}
      >
        {eventGroups.map((eventGroup, groupIndex) => (
          <div
            key={eventGroup.area}
            style={{
              ...getRiseInStyle(
                frame,
                firingStartFrame - 20 + groupIndex * 3,
                12,
                10,
              ),
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: areaColors[eventGroup.area],
              }}
            />
            {eventGroup.title}
            <span style={{ color: trailerPalette.textFaint }}>
              {eventGroup.eventNames.length}
            </span>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
}
