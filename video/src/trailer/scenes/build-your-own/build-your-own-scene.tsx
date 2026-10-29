import { AbsoluteFill } from "remotion";

import { SceneHeadline } from "../../parts/scene-headline";
import {
  EmailProviderBuilder,
  PaymentGatewayBuilder,
  SmsProviderBuilder,
  TemplateBuilder,
} from "./builder-panels";
import { buildBuilderCues, builderTimings } from "./builder-script";

export const buildYourOwnSceneDurationFrames = 330;

export const buildYourOwnSceneCues = buildBuilderCues();

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
        <TemplateBuilder {...builderTimings.template} />
        <EmailProviderBuilder {...builderTimings.emailProvider} />
        <SmsProviderBuilder {...builderTimings.smsProvider} />
        <PaymentGatewayBuilder {...builderTimings.paymentGateway} />
      </div>
    </AbsoluteFill>
  );
}
