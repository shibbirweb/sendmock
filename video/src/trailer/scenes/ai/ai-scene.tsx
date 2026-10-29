import { AbsoluteFill, Sequence } from "remotion";

import { monoFontFamily } from "../../../brand";
import { AppWindow } from "../../parts/app-window";
import { SceneHeadline } from "../../parts/scene-headline";
import { aiAgentNames } from "../../trailer-facts";
import { getFadeOutOpacity, getRiseInStyle } from "../../trailer-motion";
import { trailerPalette } from "../../trailer-palette";
import { createTypingCue, type UiCue } from "../../ui-cues";
import { AgentRoundView } from "./agent-round-view";
import {
  agentRounds,
  agentRoundTiming,
  getRoundPartFrames,
  toolCallCheckDelayFrames,
} from "./agent-rounds";
import { toVideoFrames, useDesignFrame } from "../../trailer-time";

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

/**
 * Sounds: each prompt is typed, every tool call ticks as its check mark
 * lands, and the agent's answer arrives with a success chime.
 */
export const aiSceneCues: UiCue[] = [
  { frame: 8, cueKind: "appear" },
  ...agentRounds.flatMap((agentRound, roundIndex): UiCue[] => {
    const roundStartFrame = roundStartFrames[roundIndex] ?? 0;
    const { firstToolFrame, answerFrame } = getRoundPartFrames(agentRound);
    return [
      createTypingCue(
        roundStartFrame,
        agentRound.prompt,
        agentRoundTiming.promptCharactersPerFrame,
      ),
      ...agentRound.toolCalls.map((_toolCall, callIndex): UiCue => ({
        frame:
          roundStartFrame +
          firstToolFrame +
          callIndex * agentRoundTiming.toolCallIntervalFrames +
          toolCallCheckDelayFrames,
        cueKind: "fire",
      })),
      { frame: roundStartFrame + answerFrame, cueKind: "success" },
    ];
  }),
  { frame: agentStripFrame, cueKind: "appear" },
];

/** Scene 9: everything SendMock does, asked for in plain words to an AI agent. */
export function AiScene() {
  const frame = useDesignFrame();

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
              from={toVideoFrames(roundStartFrame)}
              durationInFrames={
                isLastRound ? undefined : toVideoFrames(roundDurationFrames)
              }
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
