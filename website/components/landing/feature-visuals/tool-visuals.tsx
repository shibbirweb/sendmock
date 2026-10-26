import { CheckIcon, CreditCardIcon } from "lucide-react";

import {
  SceneCard,
  StatusPill,
  type StatusTone,
  VisualFrame,
} from "./visual-parts";

const paymentGateways = ["Stripe", "PayPal", "SSLCommerz", "bKash"];

/** A test checkout: the gateways, a test card and the signed result. */
export function PaymentsVisual() {
  return (
    <VisualFrame className="flex items-start justify-center gap-4 px-6 pt-4">
      <SceneCard className="w-64">
        <div className="flex items-center justify-between">
          <span className="font-semibold">Test checkout</span>
          <span className="font-semibold">$49.00</span>
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-lg border bg-fd-background px-2.5 py-2 font-mono">
          <CreditCardIcon className="size-3.5 text-fd-muted-foreground" />
          4242 4242 4242 4242
        </div>
        <div className="mt-3 rounded-lg bg-linear-to-r from-(--brand-from) to-(--brand-to) py-1.5 text-center font-semibold text-white">
          Pay now
        </div>
      </SceneCard>
      <div className="hidden flex-col gap-2 sm:flex">
        {paymentGateways.map((paymentGateway) => (
          <SceneCard
            key={paymentGateway}
            className="flex items-center gap-2 py-2"
          >
            <CheckIcon className="size-3.5 text-fd-success" />
            {paymentGateway}
          </SceneCard>
        ))}
      </div>
      <SceneCard className="hidden w-48 lg:block">
        <p className="font-semibold">payment.succeeded</p>
        <p className="mt-1 text-fd-muted-foreground">IPN signed and sent</p>
        <div className="mt-2">
          <StatusPill tone="success">200 OK</StatusPill>
        </div>
      </SceneCard>
    </VisualFrame>
  );
}

const caughtRequests: {
  method: string;
  path: string;
  status: string;
  tone: StatusTone;
}[] = [
  { method: "POST", path: "/slack/webhook", status: "200", tone: "success" },
  { method: "GET", path: "/v1/users/42", status: "404", tone: "warning" },
  { method: "PUT", path: "/orders/1042", status: "503", tone: "error" },
];

/** Any HTTP call your app makes, answered with the response you chose. */
export function HttpCatcherVisual() {
  return (
    <VisualFrame className="flex flex-col gap-2 px-4 pt-4">
      {caughtRequests.map((caughtRequest) => (
        <SceneCard
          key={caughtRequest.path}
          className="flex items-center gap-2 font-mono"
        >
          <span className="w-10 shrink-0 font-semibold text-(--brand-from)">
            {caughtRequest.method}
          </span>
          <span className="min-w-0 flex-1 truncate">{caughtRequest.path}</span>
          <StatusPill tone={caughtRequest.tone}>
            {caughtRequest.status}
          </StatusPill>
        </SceneCard>
      ))}
    </VisualFrame>
  );
}

const agentSessionLines = [
  { speaker: "agent", text: "sendmock_sms_wait to=+15550100" },
  { speaker: "sendmock", text: "code 482913, from Twilio" },
  { speaker: "agent", text: "sendmock_email_latest to=ana@acme.test" },
  { speaker: "sendmock", text: '"Welcome aboard", links checked' },
];

/** An AI agent using SendMock's MCP tools to read what the app sent. */
export function AiAgentsVisual() {
  return (
    <VisualFrame className="px-4 pt-5">
      <SceneCard className="flex flex-col gap-1.5 font-mono">
        {agentSessionLines.map((agentSessionLine) => (
          <p key={agentSessionLine.text} className="truncate">
            <span
              className={
                agentSessionLine.speaker === "agent"
                  ? "text-(--brand-from)"
                  : "text-fd-muted-foreground"
              }
            >
              {agentSessionLine.speaker === "agent" ? "> " : "< "}
            </span>
            {agentSessionLine.text}
          </p>
        ))}
      </SceneCard>
    </VisualFrame>
  );
}

const releaseTargets = ["macOS", "Linux", "Windows", "Docker"];

/** One small download for every system, or one image. */
export function DistributionVisual() {
  return (
    <VisualFrame className="flex flex-col items-center gap-3 px-4 pt-4">
      <div className="flex flex-wrap justify-center gap-2">
        {releaseTargets.map((releaseTarget) => (
          <SceneCard key={releaseTarget} className="px-3 py-1.5 font-medium">
            {releaseTarget}
          </SceneCard>
        ))}
      </div>
      <SceneCard className="w-full font-mono">
        <span className="text-fd-muted-foreground">$ </span>
        docker run -p 8025:8025 ghcr.io/shibbirweb/sendmock
      </SceneCard>
    </VisualFrame>
  );
}
