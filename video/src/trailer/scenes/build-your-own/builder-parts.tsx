import type { ReactNode } from "react";
import { useCurrentFrame } from "remotion";

import { monoFontFamily } from "../../../brand";
import { AppWindow } from "../../parts/app-window";
import {
  getProgress,
  getRiseInStyle,
  getTypedText,
} from "../../trailer-motion";
import { trailerPalette } from "../../trailer-palette";
import { fieldCharactersPerFrame } from "./builder-script";

type BuilderPanelProps = {
  title: string;
  appearFrame: number;
  children: ReactNode;
};

/** One builder window in the 2 by 2 grid. */
export function BuilderPanel({
  title,
  appearFrame,
  children,
}: BuilderPanelProps) {
  const frame = useCurrentFrame();

  return (
    <AppWindow
      title={title}
      style={{
        ...getRiseInStyle(frame, appearFrame, 18, 26),
        position: "relative",
      }}
      bodyStyle={{
        padding: "22px 28px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      {children}
    </AppWindow>
  );
}

type TypedFieldProps = {
  label: string;
  value: string;
  typingStartFrame: number;
  isMonospace?: boolean;
};

/** A labelled field whose value is typed in, with a caret while typing. */
export function TypedField({
  label,
  value,
  typingStartFrame,
  isMonospace = false,
}: TypedFieldProps) {
  const frame = useCurrentFrame();
  const typedValue = getTypedText(
    value,
    frame,
    typingStartFrame,
    fieldCharactersPerFrame,
  );
  const isTyping = typedValue.length > 0 && typedValue.length < value.length;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
      <div
        style={{ width: 150, fontSize: 18, color: trailerPalette.textMuted }}
      >
        {label}
      </div>
      <div
        style={{
          flex: 1,
          padding: "10px 14px",
          borderRadius: 10,
          border: `1px solid ${isTyping ? trailerPalette.accent : trailerPalette.border}`,
          backgroundColor: trailerPalette.surfaceSunken,
          fontFamily: isMonospace ? monoFontFamily : undefined,
          fontSize: isMonospace ? 18 : 20,
          minHeight: 26,
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}
      >
        {typedValue}
        {isTyping ? (
          <span style={{ color: trailerPalette.accent }}>|</span>
        ) : null}
      </div>
    </div>
  );
}

type ChoicePillsProps = {
  label: string;
  choices: string[];
  chosenChoice: string;
  chooseFrame: number;
};

/** "Start from" choices; the chosen one lights up at `chooseFrame`. */
export function ChoicePills({
  label,
  choices,
  chosenChoice,
  chooseFrame,
}: ChoicePillsProps) {
  const frame = useCurrentFrame();
  const chosenAmount = getProgress(frame, chooseFrame, 8);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
      <div
        style={{ width: 150, fontSize: 18, color: trailerPalette.textMuted }}
      >
        {label}
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        {choices.map((choice) => {
          const isChosen = choice === chosenChoice && chosenAmount > 0;
          return (
            <div
              key={choice}
              style={{
                padding: "8px 16px",
                borderRadius: 999,
                fontSize: 18,
                border: `1px solid ${isChosen ? trailerPalette.accent : trailerPalette.border}`,
                backgroundColor: isChosen
                  ? trailerPalette.accentSoft
                  : "transparent",
                color: isChosen
                  ? trailerPalette.text
                  : trailerPalette.textMuted,
                boxShadow: isChosen
                  ? `0 0 ${24 * chosenAmount}px rgba(124, 207, 189, 0.35)`
                  : undefined,
              }}
            >
              {choice}
            </div>
          );
        })}
      </div>
    </div>
  );
}
