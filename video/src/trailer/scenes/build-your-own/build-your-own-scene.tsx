import { AbsoluteFill } from "remotion";

import { SceneHeadline } from "../../parts/scene-headline";
import {
  EmailProviderBuilder,
  PaymentGatewayBuilder,
  SmsProviderBuilder,
  TemplateBuilder,
} from "./builder-panels";

export const buildYourOwnSceneDurationFrames = 330;

/** Scene 8: templates, providers and gateways SendMock does not ship, built. */
export function BuildYourOwnScene() {
  return (
    <AbsoluteFill>
      <SceneHeadline
        chapterLabel="07 · Build your own"
        headline="Missing one? Build it."
        supportingLine="Webhook templates, email and SMS providers, payment gateways."
        topPx={56}
      />
      <div
        style={{
          position: "absolute",
          left: 100,
          right: 100,
          top: 290,
          bottom: 60,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gridTemplateRows: "1fr 1fr",
          gap: 24,
        }}
      >
        <TemplateBuilder appearFrame={16} workStartFrame={50} />
        <EmailProviderBuilder appearFrame={26} workStartFrame={80} />
        <SmsProviderBuilder appearFrame={36} workStartFrame={120} />
        <PaymentGatewayBuilder appearFrame={46} workStartFrame={160} />
      </div>
    </AbsoluteFill>
  );
}
