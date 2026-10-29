import {
  Braces,
  CreditCard,
  type LucideIcon,
  Mail,
  MessageSquare,
} from "lucide-react";
import {
  AbsoluteFill,
  Img,
  Sequence,
  staticFile,
  useCurrentFrame,
} from "remotion";

import { fontFamily } from "../../brand";
import { getRiseInStyle } from "../trailer-motion";
import { trailerPalette } from "../trailer-palette";
import type { UiCue } from "../ui-cues";

type ChannelBeat = {
  word: string;
  Icon: LucideIcon;
  durationFrames: number;
};

const channelBeats: ChannelBeat[] = [
  { word: "Email.", Icon: Mail, durationFrames: 20 },
  { word: "SMS.", Icon: MessageSquare, durationFrames: 18 },
  { word: "Payments.", Icon: CreditCard, durationFrames: 20 },
  { word: "Any API.", Icon: Braces, durationFrames: 24 },
];

const channelBeatsDurationFrames = channelBeats.reduce(
  (total, channelBeat) => total + channelBeat.durationFrames,
  0,
);
const localhostLineDurationFrames = 66;
const logoDurationFrames = 64;
export const openingSceneDurationFrames =
  channelBeatsDurationFrames + localhostLineDurationFrames + logoDurationFrames;

/** When each word, the localhost line and the logo land; the music hits here. */
export const openingCueFrames = {
  channelWordFrames: channelBeats.map((_channelBeat, beatIndex) =>
    channelBeats
      .slice(0, beatIndex)
      .reduce((total, earlierBeat) => total + earlierBeat.durationFrames, 0),
  ),
  localhostLineFrame: channelBeatsDurationFrames,
  logoFrame: channelBeatsDurationFrames + localhostLineDurationFrames,
};

export const openingSceneCues: UiCue[] = [
  ...openingCueFrames.channelWordFrames.map((wordFrame): UiCue => ({
    frame: wordFrame,
    cueKind: "appear",
  })),
  { frame: openingCueFrames.localhostLineFrame, cueKind: "whoosh" },
  { frame: openingCueFrames.logoFrame, cueKind: "reveal" },
];

/** Scene 1: the channels in big words, the promise, then the logo. */
export function OpeningScene() {
  let beatStartFrame = 0;
  const beatSequences = channelBeats.map((channelBeat) => {
    const sequenceStart = beatStartFrame;
    beatStartFrame += channelBeat.durationFrames;
    return (
      <Sequence
        key={channelBeat.word}
        from={sequenceStart}
        durationInFrames={channelBeat.durationFrames}
      >
        <ChannelWord channelBeat={channelBeat} />
      </Sequence>
    );
  });

  return (
    <AbsoluteFill style={{ fontFamily, color: trailerPalette.text }}>
      {beatSequences}
      <Sequence
        from={channelBeatsDurationFrames}
        durationInFrames={localhostLineDurationFrames}
      >
        <LocalhostLine />
      </Sequence>
      <Sequence from={channelBeatsDurationFrames + localhostLineDurationFrames}>
        <LogoReveal />
      </Sequence>
    </AbsoluteFill>
  );
}

function ChannelWord({ channelBeat }: { channelBeat: ChannelBeat }) {
  const frame = useCurrentFrame();
  const driftScale = 1 + frame * 0.002;

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          ...getRiseInStyle(frame, 0, 7, 14),
          display: "flex",
          alignItems: "center",
          gap: 44,
          transform: `scale(${driftScale})`,
        }}
      >
        <channelBeat.Icon
          size={130}
          strokeWidth={1.3}
          color={trailerPalette.accent}
        />
        <span style={{ fontSize: 190, fontWeight: 600, letterSpacing: -6 }}>
          {channelBeat.word}
        </span>
      </div>
    </AbsoluteFill>
  );
}

function LocalhostLine() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
      }}
    >
      <div
        style={{
          ...getRiseInStyle(frame, 0, 10),
          fontSize: 120,
          fontWeight: 600,
          letterSpacing: -4,
        }}
      >
        Every webhook,
      </div>
      <div
        style={{
          ...getRiseInStyle(frame, 10, 10),
          fontSize: 120,
          fontWeight: 600,
          letterSpacing: -4,
          color: trailerPalette.accent,
        }}
      >
        on localhost.
      </div>
    </AbsoluteFill>
  );
}

function LogoReveal() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          ...getRiseInStyle(frame, 0, 16, 20),
          display: "flex",
          alignItems: "center",
          gap: 36,
        }}
      >
        <Img
          src={staticFile("brand/sendmock-logo.svg")}
          style={{
            width: 150,
            height: 150,
            filter: "drop-shadow(0 0 60px rgba(13, 148, 136, 0.45))",
          }}
        />
        <span style={{ fontSize: 150, fontWeight: 600, letterSpacing: -5 }}>
          SendMock
        </span>
      </div>
    </AbsoluteFill>
  );
}
