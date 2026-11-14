/** The CLI's own conventions (docs/plan/14-ai-integration.md, agent-friendly conventions). */
import type { CliReference } from "./reference-types";

export const globalFlags: CliReference["global_flags"] = [
  {
    flag: "--json",
    value_label: null,
    description:
      "Prints the answer as JSON; the default when the output is not a terminal.",
  },
  {
    flag: "--server",
    value_label: "<url>",
    description:
      "The SendMock to talk to (`SENDMOCK_SERVER`, default `http://127.0.0.1:8025`).",
  },
  {
    flag: "--token",
    value_label: "<token>",
    description: "The API token when auth is on (`SENDMOCK_TOKEN`).",
  },
  {
    flag: "--data",
    value_label: "<json>",
    description: "The whole body as JSON; flags override its keys.",
  },
  {
    flag: "--file",
    value_label: "<path>",
    description: "The whole body from a JSON or TOML file; `-` reads stdin.",
  },
  {
    flag: "--help",
    value_label: null,
    description: "Prints the command's help with examples.",
  },
];

export const exitCodes: CliReference["exit_codes"] = [
  { code: 0, meaning: "Done." },
  {
    code: 1,
    meaning: "The request failed (invalid input, conflict, server error).",
  },
  {
    code: 2,
    meaning:
      "Usage error: an unknown flag, a missing argument or a value outside the allowed ones.",
  },
  { code: 3, meaning: "Not found." },
  { code: 4, meaning: "Timed out waiting." },
  { code: 5, meaning: "An assertion failed (scenarios)." },
];

export const switchDescriptions: Record<string, string> = {
  "--yes": "Confirms a destructive command; without it the command stops.",
  "--reveal": "Prints the secret in plain text instead of masked.",
};

export const exampleFileNames: Record<string, string> = {
  seed_toml: "sendmock.seed.toml",
  scenario: "otp-login.toml",
  file_text: "template.toml",
};
