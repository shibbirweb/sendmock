import type { IsoTimestamp, Ulid } from "@/lib/api/types/common";

/** Answer of GET /api/v1/otp: the latest code sent to a recipient. */
export type OtpLookup = {
  to: string;
  channel: "email" | "sms" | "verify";
  code: string;
  /** The email or SMS id, or the verification SID, that carried it. */
  source_id: string;
  received_at: IsoTimestamp;
};

/** Answer of GET /api/v1/links: the links of the latest email to a recipient. */
export type LinksLookup = {
  to: string;
  email_id: Ulid;
  links: string[];
  received_at: IsoTimestamp;
};

/** Optional body of POST /api/v1/samples/email (`sendmock email send-test`). */
export type SampleOptions = {
  /**
   * The recipient of the sample email.
   * @example "user@example.test"
   */
  to?: string;
  /**
   * The subject of the sample email.
   * @example "Hello from SendMock"
   */
  subject?: string;
  /**
   * The HTML body of the sample email.
   * @example "<p>It works!</p>"
   */
  html?: string;
};

export type IntegrationChannel = "email" | "sms" | "http";

/** Answer of GET /api/v1/integrations/{stack}: copy-ready settings, as Settings > Connection shows. */
export type IntegrationSnippet = {
  stack: string;
  channel: IntegrationChannel;
  /** The host the app reaches SendMock on: `127.0.0.1`, `host.docker.internal` or `sendmock`. */
  host: string;
  language: string;
  code: string;
};

/** Body of POST /api/v1/scenarios/validate and /run: a scenario file's TOML text. */
export type ScenarioRequest = {
  /**
   * The scenario file's text, in TOML.
   * @example "name = \"otp-login\"\n\n[[steps]]\nrun = \"sample.send\"\nwith = { kind = \"sms\" }"
   */
  scenario: string;
};

export type ScenarioProblem = {
  /** One-based step number, or null for the whole file. */
  step: number | null;
  message: string;
};

export type ScenarioValidation = {
  is_valid: boolean;
  name: string | null;
  step_count: number;
  problems: ScenarioProblem[];
};

export type ScenarioStepStatus = "passed" | "failed" | "skipped";

export type ScenarioStepResult = {
  /** One-based. */
  step: number;
  /** The operation, e.g. `webhook.endpoint.create`, or `http`, `assert`, `sleep`. */
  run: string;
  status: ScenarioStepStatus;
  input: Record<string, unknown>;
  output: unknown;
  error: string | null;
  /** The name the step's output was saved under for later steps. */
  saved_as: string | null;
  duration_ms: number;
};

/** Answer of POST /api/v1/scenarios/run: a step-by-step report. */
export type ScenarioReport = {
  name: string;
  is_passed: boolean;
  started_at: IsoTimestamp;
  duration_ms: number;
  steps: ScenarioStepResult[];
};

export type AiAgentTarget =
  "claude-code" | "codex" | "cursor" | "gemini" | "vscode";

/** One item of GET /api/v1/ai/agents: how to connect an AI agent. */
export type AiAgentSetup = {
  target: AiAgentTarget;
  name: string;
  install_command: string;
  /** Where the MCP configuration goes, e.g. `.cursor/mcp.json`. */
  mcp_config_path: string;
  mcp_config: string;
  /** Where the skill or instructions go, e.g. `.claude/skills/sendmock/`. */
  instructions_path: string;
};
