import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

import {
  getActiveStepIndex,
  getProgress,
  getSlideInStyle,
} from "../trailer-motion";
import type { UiCue, UiCueKind } from "../ui-cues";
import { AppTerminal, type TerminalLine } from "./app-terminal";
import { AppWindow } from "./app-window";
import { type FlowDirection, FlowLine } from "./flow-line";
import { RequestCard, type WebhookRequest } from "./request-card";
import { SceneHeadline } from "./scene-headline";

export type WebhookFlowStep = {
  /** When the event happens in SendMock (or, for "fromApp", in your app). */
  startFrame: number;
  request: WebhookRequest;
  logLine: string;
};

type WebhookFlowSceneProps = {
  chapterLabel: string;
  headline: string;
  productTitle: string;
  renderProductPanel: (activeStepIndex: number) => ReactNode;
  appTitle: string;
  /** Lines your app prints itself, besides the webhooks it receives. */
  appOwnLines: TerminalLine[];
  steps: WebhookFlowStep[];
  direction: FlowDirection;
};

const productWindow = { leftPx: 80, topPx: 270, widthPx: 740, heightPx: 640 };
const appWindow = { leftPx: 1340, topPx: 300, widthPx: 500, heightPx: 460 };
const flowLineYPx = 430;
const requestCard = { leftPx: 838, topPx: 490, widthPx: 484 };
const travelDurationFrames = 20;
const requestLeadFrames = 6;
const cardLaunchFrames = 16;
const productWindowAppearFrame = 6;
const appWindowAppearFrame = 12;

/** The frame a step's request lands at the other end of the line. */
export function getStepArrivalFrame(step: WebhookFlowStep): number {
  return step.startFrame + requestLeadFrames + travelDurationFrames;
}

/**
 * The sounds every feature scene shares: the windows appear, each request
 * leaves with a swoosh and lands with its outcome (a success chime unless the
 * scene says otherwise).
 */
export function buildWebhookFlowCues(
  steps: WebhookFlowStep[],
  getArrivalCueKind: (stepIndex: number) => UiCueKind = () => "success",
): UiCue[] {
  return [
    { frame: productWindowAppearFrame, cueKind: "appear" },
    { frame: appWindowAppearFrame, cueKind: "appear" },
    ...steps.flatMap((step, stepIndex): UiCue[] => [
      { frame: step.startFrame, cueKind: "send" },
      {
        frame: getStepArrivalFrame(step),
        cueKind: getArrivalCueKind(stepIndex),
      },
    ]),
  ];
}

/**
 * The feature scenes' shared layout: SendMock on the left, your app's terminal
 * on the right, and each webhook travelling between them with its request.
 */
export function WebhookFlowScene({
  chapterLabel,
  headline,
  productTitle,
  renderProductPanel,
  appTitle,
  appOwnLines,
  steps,
  direction,
}: WebhookFlowSceneProps) {
  const frame = useCurrentFrame();
  const stepStartFrames = steps.map((step) => step.startFrame);
  const activeStepIndex = getActiveStepIndex(frame, stepStartFrames);
  const travelStartFrames = stepStartFrames.map(
    (startFrame) => startFrame + requestLeadFrames,
  );
  const terminalLines: TerminalLine[] = [
    ...appOwnLines,
    ...steps.map((step) => ({
      text: step.logLine,
      appearFrame:
        direction === "toApp"
          ? step.startFrame + requestLeadFrames + travelDurationFrames
          : step.startFrame,
      tone: direction === "toApp" ? ("status" as const) : ("plain" as const),
    })),
  ].sort((first, second) => first.appearFrame - second.appearFrame);

  return (
    <AbsoluteFill>
      <SceneHeadline chapterLabel={chapterLabel} headline={headline} />
      <AppWindow
        title={productTitle}
        style={{
          ...getSlideInStyle(frame, productWindowAppearFrame, 20, -140),
          left: productWindow.leftPx,
          top: productWindow.topPx,
          width: productWindow.widthPx,
          height: productWindow.heightPx,
        }}
      >
        {renderProductPanel(activeStepIndex)}
      </AppWindow>
      <AppTerminal
        title={appTitle}
        lines={terminalLines}
        style={{
          ...getSlideInStyle(frame, appWindowAppearFrame, 20, 140),
          left: appWindow.leftPx,
          top: appWindow.topPx,
          width: appWindow.widthPx,
          height: appWindow.heightPx,
        }}
      />
      <FlowLine
        startXPx={productWindow.leftPx + productWindow.widthPx}
        endXPx={appWindow.leftPx}
        yPx={flowLineYPx}
        direction={direction}
        travelStartFrames={travelStartFrames}
        travelDurationFrames={travelDurationFrames}
      />
      {steps.map((step, stepIndex) => {
        const nextStep = steps[stepIndex + 1];
        const isVisible =
          frame >= step.startFrame &&
          (nextStep === undefined || frame < nextStep.startFrame + 10);
        if (!isVisible) {
          return null;
        }
        return (
          <RequestCard
            key={step.startFrame}
            request={step.request}
            style={{
              ...getRequestCardMotionStyle(
                frame,
                step.startFrame,
                nextStep?.startFrame,
                direction,
              ),
              left: requestCard.leftPx,
              top: requestCard.topPx,
              width: requestCard.widthPx,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
}

/**
 * A request card is launched from the sending window's edge: it starts small
 * on the line, grows as it travels into place, and drops away when the next
 * request takes over.
 */
function getRequestCardMotionStyle(
  frame: number,
  startFrame: number,
  nextStartFrame: number | undefined,
  direction: FlowDirection,
): CSSProperties {
  const launchProgress = getProgress(frame, startFrame, cardLaunchFrames);
  const leaveProgress =
    nextStartFrame === undefined ? 0 : getProgress(frame, nextStartFrame, 10);
  const senderEdgeXPx =
    direction === "toApp"
      ? productWindow.leftPx + productWindow.widthPx
      : appWindow.leftPx;
  const cardCenterXPx = requestCard.leftPx + requestCard.widthPx / 2;
  const launchOffsetXPx =
    (senderEdgeXPx - cardCenterXPx) * (1 - launchProgress);
  const launchOffsetYPx =
    (flowLineYPx - requestCard.topPx) * (1 - launchProgress);
  return {
    opacity: Math.min(1, launchProgress * 2) * (1 - leaveProgress),
    transform: [
      `translate(${launchOffsetXPx}px, ${launchOffsetYPx + leaveProgress * 40}px)`,
      `scale(${0.25 + launchProgress * 0.75 - leaveProgress * 0.06})`,
    ].join(" "),
    transformOrigin: "50% 0%",
    filter:
      launchProgress < 1 || leaveProgress > 0
        ? `blur(${(1 - launchProgress) * 6 + leaveProgress * 8}px)`
        : undefined,
  };
}
