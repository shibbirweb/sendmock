import { CreditCardIcon } from "lucide-react";

import {
  SceneCard,
  StatusPill,
  type StatusTone,
  VisualFrame,
} from "./visual-parts";

/** A test checkout with a test card, and the signed result it sends. */
export function PaymentsVisual() {
  return (
    <VisualFrame className="flex items-center justify-center px-5">
      <SceneCard className="w-full max-w-64">
        <div className="flex items-center justify-between">
          <span className="font-semibold">Test checkout</span>
          <span className="font-semibold">$49.00</span>
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-lg border bg-fd-background px-2.5 py-2 font-mono">
          <CreditCardIcon className="size-3.5 text-fd-muted-foreground" />
          4242 4242 4242 4242
        </div>
        <div className="mt-3 rounded-lg bg-fd-primary py-1.5 text-center font-semibold text-fd-primary-foreground">
          Pay now
        </div>
        <div className="mt-2.5 flex items-center justify-between">
          <span className="text-fd-muted-foreground">IPN signed and sent</span>
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
  { method: "PUT", path: "/orders/1042", status: "503", tone: "error" },
];

/** Any HTTP call your app makes, answered with the response you chose. */
export function HttpCatcherVisual() {
  return (
    <VisualFrame className="flex flex-col justify-center gap-2 px-5">
      {caughtRequests.map((caughtRequest) => (
        <SceneCard
          key={caughtRequest.path}
          className="flex items-center gap-2 font-mono"
        >
          <span className="w-10 shrink-0 font-semibold text-(--brand-text)">
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
    <VisualFrame className="flex items-center px-5">
      <SceneCard className="flex w-full flex-col gap-1.5 font-mono">
        {agentSessionLines.map((agentSessionLine) => (
          <p key={agentSessionLine.text} className="truncate">
            <span
              className={
                agentSessionLine.speaker === "agent"
                  ? "text-(--brand-text)"
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
