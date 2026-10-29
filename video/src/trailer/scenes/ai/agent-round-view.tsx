import { monoFontFamily } from "../../../brand";
import {
  getProgress,
  getRiseInStyle,
  getTypedText,
} from "../../trailer-motion";
import { trailerPalette } from "../../trailer-palette";
import {
  type AgentRound,
  agentRoundTiming,
  getRoundPartFrames,
  toolCallCheckDelayFrames,
} from "./agent-rounds";
import { useDesignFrame } from "../../trailer-time";

type AgentRoundViewProps = {
  agentRound: AgentRound;
};

/** One prompt, the tool calls the agent makes and its one-line answer. */
export function AgentRoundView({ agentRound }: AgentRoundViewProps) {
  const frame = useDesignFrame();
  const { promptEndFrame, firstToolFrame, answerFrame } =
    getRoundPartFrames(agentRound);
  const typedPrompt = getTypedText(
    agentRound.prompt,
    frame,
    0,
    agentRoundTiming.promptCharactersPerFrame,
  );
  const isTypingPrompt = frame < promptEndFrame + 6;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
      <div
        style={{
          display: "flex",
          gap: 18,
          padding: "20px 24px",
          borderRadius: 14,
          border: `1px solid ${isTypingPrompt ? trailerPalette.accent : trailerPalette.border}`,
          backgroundColor: trailerPalette.surfaceSunken,
          fontSize: 38,
          lineHeight: 1.4,
        }}
      >
        <span style={{ color: trailerPalette.accent }}>›</span>
        <span>
          {typedPrompt}
          {isTypingPrompt ? (
            <span style={{ color: trailerPalette.accent }}>|</span>
          ) : null}
        </span>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          paddingLeft: 8,
        }}
      >
        {agentRound.toolCalls.map((toolCall, callIndex) => {
          const callFrame =
            firstToolFrame +
            callIndex * agentRoundTiming.toolCallIntervalFrames;
          if (frame < callFrame) {
            return null;
          }
          const doneAmount = getProgress(
            frame,
            callFrame + toolCallCheckDelayFrames,
            6,
          );
          return (
            <div
              key={toolCall.toolName}
              style={{
                ...getRiseInStyle(frame, callFrame, 10, 10),
                display: "flex",
                alignItems: "center",
                gap: 16,
                fontFamily: monoFontFamily,
                fontSize: 26,
              }}
            >
              <span
                style={{
                  color:
                    doneAmount > 0.5
                      ? trailerPalette.success
                      : trailerPalette.textFaint,
                  width: 22,
                }}
              >
                {doneAmount > 0.5 ? "✓" : "•"}
              </span>
              <span style={{ color: trailerPalette.accent }}>
                {toolCall.toolName}
              </span>
              <span style={{ color: trailerPalette.textFaint }}>
                {toolCall.argumentsSummary}
              </span>
            </div>
          );
        })}
      </div>
      {frame >= answerFrame ? (
        <div
          style={{
            ...getRiseInStyle(frame, answerFrame, 14, 12),
            fontSize: 32,
            color: trailerPalette.text,
            paddingLeft: 8,
          }}
        >
          {agentRound.answer}
        </div>
      ) : null}
    </div>
  );
}
