import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";

import { monoFontFamily } from "../../../brand";
import { AppWindow } from "../../parts/app-window";
import { SceneHeadline } from "../../parts/scene-headline";
import { aiAgentNames } from "../../trailer-facts";
import { getFadeOutOpacity, getRiseInStyle } from "../../trailer-motion";
import { trailerPalette } from "../../trailer-palette";
import { AgentRoundView } from "./agent-round-view";
import { agentRounds, getRoundPartFrames } from "./agent-rounds";

const firstRoundStartFrame = 24;
const roundFadeFrames = 8;

const roundStartFrames = agentRounds.reduce<number[]>(
  (startFrames, agentRound, roundIndex) => {
    const previousStart = startFrames[roundIndex - 1];
    const previousRound = agentRounds[roundIndex - 1];
    if (previousStart === undefined || previousRound === undefined) {
      return [firstRoundStartFrame];
    }
    return [
      ...startFrames,
      previousStart + getRoundPartFrames(previousRound).roundEndFrame,
    ];
  },
  [],
);

const agentStripFrame = roundStartFrames[2] ?? 0;
const lastRound = agentRounds[agentRounds.length - 1];
export const aiSceneDurationFrames =
  (roundStartFrames[roundStartFrames.length - 1] ?? 0) +
  (lastRound === undefined ? 0 : getRoundPartFrames(lastRound).roundEndFrame) +
  20;

/** Scene 9: everything SendMock does, asked for in plain words to an AI agent. */
export function AiScene() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <SceneHeadline
        chapterLabel="08 · AI ready"
        headline="AI ready. Everything, by prompt."
      />
      <AppWindow
        title="AI agent · acme-shop · sendmock MCP"
        style={{
          ...getRiseInStyle(frame, 8, 18, 30),
          left: 250,
          top: 250,
          width: 1420,
          height: 570,
        }}
        bodyStyle={{ padding: "34px 40px" }}
      >
        {agentRounds.map((agentRound, roundIndex) => {
          const roundStartFrame = roundStartFrames[roundIndex] ?? 0;
          const roundDurationFrames =
            getRoundPartFrames(agentRound).roundEndFrame;
          const isLastRound = roundIndex === agentRounds.length - 1;
          const fadeOpacity = isLastRound
            ? 1
            : getFadeOutOpacity(
                frame,
                roundStartFrame + roundDurationFrames - roundFadeFrames,
                roundFadeFrames,
              );
          return (
            <Sequence
              key={agentRound.prompt}
              from={roundStartFrame}
              durationInFrames={isLastRound ? undefined : roundDurationFrames}
              layout="none"
            >
              <div style={{ opacity: fadeOpacity }}>
                <AgentRoundView agentRound={agentRound} />
              </div>
            </Sequence>
          );
        })}
      </AppWindow>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 870,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 14,
          fontSize: 22,
          color: trailerPalette.textMuted,
        }}
      >
        <span style={getRiseInStyle(frame, agentStripFrame, 12, 10)}>
          Works with
        </span>
        {aiAgentNames.map((agentName, agentIndex) => (
          <span
            key={agentName}
            style={{
              ...getRiseInStyle(
                frame,
                agentStripFrame + 4 + agentIndex * 4,
                12,
                10,
              ),
              padding: "8px 16px",
              borderRadius: 999,
              border: `1px solid ${trailerPalette.border}`,
              color: trailerPalette.text,
            }}
          >
            {agentName}
          </span>
        ))}
        <span
          style={{
            ...getRiseInStyle(frame, agentStripFrame + 30, 12, 10),
            marginLeft: 12,
            padding: "8px 16px",
            borderRadius: 10,
            backgroundColor: trailerPalette.surfaceRaised,
            fontFamily: monoFontFamily,
            color: trailerPalette.accent,
          }}
        >
          $ sendmock ai install
        </span>
      </div>
    </AbsoluteFill>
  );
}
