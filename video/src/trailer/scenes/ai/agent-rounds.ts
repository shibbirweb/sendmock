/**
 * The example prompts of scene 9 (docs/plan/23-promotional-video.md), with
 * the real SendMock MCP tool names each one uses (docs/plan/14-ai-integration.md).
 */
export type AgentToolCall = {
  toolName: string;
  argumentsSummary: string;
};

export type AgentRound = {
  prompt: string;
  toolCalls: AgentToolCall[];
  answer: string;
};

export const agentRounds: AgentRound[] = [
  {
    prompt: "Add Upay as a payment gateway: wallet number, OTP, then PIN.",
    toolCalls: [
      {
        toolName: "sendmock_payment_flow_create",
        argumentsSummary: 'name: "Upay wallet"',
      },
      {
        toolName: "sendmock_payment_flow_step_add",
        argumentsSummary: "wallet number, OTP, PIN",
      },
      {
        toolName: "sendmock_payment_gateway_create",
        argumentsSummary: 'key: "upay"',
      },
      {
        toolName: "sendmock_payment_gateway_preview",
        argumentsSummary: "checkout",
      },
    ],
    answer: "Upay is ready: 3 steps, and the checkout preview passes.",
  },
  {
    prompt: "Test the signup: get the OTP from the SMS.",
    toolCalls: [
      { toolName: "sendmock_sms_list", argumentsSummary: 'to: "+12025550100"' },
      { toolName: "sendmock_otp_get", argumentsSummary: "latest SMS" },
    ],
    answer: "Code 482913, sent to +1 202 555 0100. Signup verified.",
  },
  {
    prompt: "Send bounced emails to my app in SendGrid's format, then test it.",
    toolCalls: [
      {
        toolName: "sendmock_webhook_endpoint_create",
        argumentsSummary: 'template: "sendgrid.events"',
      },
      {
        toolName: "sendmock_outcome_rule_create",
        argumentsSummary: "outcome: bounce",
      },
      {
        toolName: "sendmock_email_send_test",
        argumentsSummary: 'to: "maya@example.com"',
      },
      {
        toolName: "sendmock_webhook_delivery_wait",
        argumentsSummary: "email.bounced",
      },
    ],
    answer: "email.bounced reached your app in SendGrid's format: 200 OK.",
  },
];

/** Frames used by one round's parts, shared by the timeline and the view. */
export const agentRoundTiming = {
  promptCharactersPerFrame: 0.9,
  thinkFrames: 12,
  toolCallIntervalFrames: 11,
  answerDelayFrames: 10,
  holdFrames: 54,
};

/** Frame (inside the round) at which the given part starts. */
export function getRoundPartFrames(agentRound: AgentRound) {
  const promptEndFrame = Math.ceil(
    agentRound.prompt.length / agentRoundTiming.promptCharactersPerFrame,
  );
  const firstToolFrame = promptEndFrame + agentRoundTiming.thinkFrames;
  const answerFrame =
    firstToolFrame +
    agentRound.toolCalls.length * agentRoundTiming.toolCallIntervalFrames +
    agentRoundTiming.answerDelayFrames;
  const roundEndFrame = answerFrame + agentRoundTiming.holdFrames;
  return { promptEndFrame, firstToolFrame, answerFrame, roundEndFrame };
}
