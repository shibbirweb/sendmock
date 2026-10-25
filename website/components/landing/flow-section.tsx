"use client";

import {
  BotIcon,
  CreditCardIcon,
  GlobeIcon,
  MailIcon,
  MessageSquareIcon,
  MonitorIcon,
  WebhookIcon,
  type LucideIcon,
} from "lucide-react";
import { createRef, forwardRef, useRef, useState } from "react";

import { SendMockLogo } from "@/components/sendmock-logo";
import { AnimatedBeam } from "@/components/ui/animated-beam";
import { cn } from "@/lib/utils";

type FlowNode = { label: string; Icon: LucideIcon };

const inboundNodes: FlowNode[] = [
  { label: "SMTP email", Icon: MailIcon },
  { label: "SMS and Verify", Icon: MessageSquareIcon },
  { label: "Payments", Icon: CreditCardIcon },
  { label: "Any HTTP call", Icon: GlobeIcon },
];

const outboundNodes: FlowNode[] = [
  { label: "Web UI", Icon: MonitorIcon },
  { label: "Webhooks to your app", Icon: WebhookIcon },
  { label: "CLI and MCP for agents", Icon: BotIcon },
];

const FlowNodeCircle = forwardRef<
  HTMLDivElement,
  { node: FlowNode; className?: string }
>(function FlowNodeCircle({ node, className }, nodeRef) {
  return (
    <div className="flex flex-col items-center gap-1.5 text-center">
      <div
        ref={nodeRef}
        className={cn(
          "z-10 flex size-12 items-center justify-center rounded-full border bg-fd-card shadow-sm",
          className,
        )}
      >
        <node.Icon aria-hidden="true" className="size-5" />
      </div>
      <span className="max-w-24 text-xs text-fd-muted-foreground">
        {node.label}
      </span>
    </div>
  );
});

/** Your app sends to SendMock; SendMock shows it, calls your webhooks and answers agents. */
export function FlowSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const hubRef = useRef<HTMLDivElement>(null);
  // One stable ref per node; the node lists never change.
  const [inboundRefs] = useState(() =>
    inboundNodes.map(() => createRef<HTMLDivElement>()),
  );
  const [outboundRefs] = useState(() =>
    outboundNodes.map(() => createRef<HTMLDivElement>()),
  );

  return (
    <section
      aria-labelledby="flow-heading"
      className="mx-auto flex w-full max-w-4xl flex-col items-center gap-8 px-4 py-16"
    >
      <div className="flex flex-col items-center gap-2 text-center">
        <h2 id="flow-heading" className="text-2xl font-semibold">
          Point your app at SendMock
        </h2>
        <p className="max-w-xl text-fd-muted-foreground">
          Change one host and port. Everything your app sends is caught, shown
          and answered like the real provider would.
        </p>
      </div>
      <div
        ref={containerRef}
        data-testid="flow-diagram"
        className="relative flex w-full items-center justify-between gap-4 rounded-2xl border bg-fd-card/50 p-6 sm:p-10"
      >
        <div className="flex flex-col gap-6">
          {inboundNodes.map((inboundNode, nodeIndex) => (
            <FlowNodeCircle
              key={inboundNode.label}
              node={inboundNode}
              ref={inboundRefs[nodeIndex]}
            />
          ))}
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <div
            ref={hubRef}
            className="z-10 flex size-20 items-center justify-center rounded-2xl border bg-fd-background shadow-md"
          >
            <SendMockLogo className="size-12" />
          </div>
          <span className="text-sm font-medium">SendMock</span>
        </div>
        <div className="flex flex-col gap-8">
          {outboundNodes.map((outboundNode, nodeIndex) => (
            <FlowNodeCircle
              key={outboundNode.label}
              node={outboundNode}
              ref={outboundRefs[nodeIndex]}
            />
          ))}
        </div>
        {inboundNodes.map((inboundNode, nodeIndex) => (
          <AnimatedBeam
            key={inboundNode.label}
            containerRef={containerRef}
            fromRef={inboundRefs[nodeIndex]}
            toRef={hubRef}
            curvature={(nodeIndex - 1.5) * 30}
            gradientStartColor="var(--brand-from)"
            gradientStopColor="var(--brand-to)"
            delay={nodeIndex * 0.4}
          />
        ))}
        {outboundNodes.map((outboundNode, nodeIndex) => (
          <AnimatedBeam
            key={outboundNode.label}
            containerRef={containerRef}
            fromRef={hubRef}
            toRef={outboundRefs[nodeIndex]}
            curvature={(nodeIndex - 1) * -30}
            gradientStartColor="var(--brand-from)"
            gradientStopColor="var(--brand-to)"
            delay={1.6 + nodeIndex * 0.4}
          />
        ))}
      </div>
    </section>
  );
}
