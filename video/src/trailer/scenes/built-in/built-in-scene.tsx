import { AbsoluteFill } from "remotion";

import { SceneHeadline } from "../../parts/scene-headline";
import type { UiCue } from "../../ui-cues";
import {
  emailProviders,
  paymentGateways,
  smsProviders,
  webhookTemplateNames,
} from "../../trailer-facts";
import { BentoTile } from "./bento-tile";
import {
  BrandedNameList,
  CodeLines,
  ScrollingNameList,
} from "./bento-contents";

export const builtInSceneDurationFrames = 330;

const tileStartFrames = {
  email: 18,
  sms: 28,
  payments: 38,
  templates: 48,
  signed: 58,
  errors: 66,
};

/** Sounds: a soft pop as each tile lands. */
export const builtInSceneCues: UiCue[] = Object.values(tileStartFrames).map(
  (tileStartFrame): UiCue => ({ frame: tileStartFrame, cueKind: "appear" }),
);

/** Scene 6: the built-in providers, gateways and templates, as a bento grid. */
export function BuiltInScene() {
  return (
    <AbsoluteFill>
      <SceneHeadline
        chapterLabel="05 · Built in"
        headline="Built in. Ready on first run."
      />
      <div
        style={{
          position: "absolute",
          left: 120,
          right: 120,
          top: 250,
          bottom: 80,
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gridTemplateRows: "repeat(4, 1fr)",
          gridTemplateAreas: [
            '"email email sms sms"',
            '"email email sms sms"',
            '"payments templates templates signed"',
            '"payments templates templates errors"',
          ].join(" "),
          gap: 20,
        }}
      >
        <BentoTile
          title="email providers"
          count={emailProviders.length}
          startFrame={tileStartFrames.email}
          gridArea="email"
        >
          <BrandedNameList
            brandedNames={emailProviders}
            startFrame={tileStartFrames.email}
            columnCount={3}
          />
        </BentoTile>
        <BentoTile
          title="SMS providers"
          count={smsProviders.length}
          startFrame={tileStartFrames.sms}
          gridArea="sms"
        >
          <BrandedNameList
            brandedNames={smsProviders}
            startFrame={tileStartFrames.sms}
            columnCount={3}
          />
        </BentoTile>
        <BentoTile
          title="payment gateways"
          count={paymentGateways.length}
          startFrame={tileStartFrames.payments}
          gridArea="payments"
          style={{ padding: "26px 20px" }}
        >
          <BrandedNameList
            brandedNames={paymentGateways}
            startFrame={tileStartFrames.payments}
            columnCount={2}
          />
        </BentoTile>
        <BentoTile
          title="webhook templates"
          count={webhookTemplateNames.length}
          startFrame={tileStartFrames.templates}
          gridArea="templates"
        >
          <ScrollingNameList
            names={webhookTemplateNames}
            startFrame={tileStartFrames.templates}
            heightPx={200}
          />
        </BentoTile>
        <BentoTile
          title="Signed like the real thing"
          startFrame={tileStartFrames.signed}
          gridArea="signed"
          titleFontSizePx={22}
          style={{ padding: "22px 26px" }}
        >
          <CodeLines
            lines={["X-Twilio-Signature", "Stripe-Signature"]}
            startFrame={tileStartFrames.signed}
          />
        </BentoTile>
        <BentoTile
          title="Real responses and errors"
          startFrame={tileStartFrames.errors}
          gridArea="errors"
          titleFontSizePx={22}
          style={{ padding: "22px 26px" }}
        >
          <CodeLines
            lines={["21211 Invalid 'To' number", "card_declined"]}
            startFrame={tileStartFrames.errors}
          />
        </BentoTile>
      </div>
    </AbsoluteFill>
  );
}
