import type { IntegrationSnippet } from "@/lib/api/types";
import {
  type AppLocation,
  appLocationHosts,
  buildConnectionSnippets,
  type SnippetLanguage,
  snippetLanguages,
} from "@/lib/settings/build-connection-snippets";

/** Stack names people use, to the snippet language that covers them. */
const stackLanguages: Record<string, SnippetLanguage> = {
  ...Object.fromEntries(
    snippetLanguages.map((language) => [language, language]),
  ),
  php: "laravel",
  express: "node",
  nestjs: "node",
  django: "python",
  flask: "python",
  fastapi: "python",
  spring: "java",
  rails: "ruby",
  aspnet: "dotnet",
};

const hostLocations: Record<string, AppLocation> = {
  local: "this-machine",
  "this-machine": "this-machine",
  "docker-host": "docker-host",
  compose: "compose",
};

const channelAreas = { email: "smtp", sms: "sms", http: "catcher" } as const;

/** `GET /integrations/{stack}`: the Settings > Connection snippet for one stack and channel. */
export function buildIntegrationSnippet(
  stack: string,
  channelText: string | null,
  hostText: string | null,
): IntegrationSnippet | null {
  const language = stackLanguages[stack.toLowerCase()];
  if (language === undefined) {
    return null;
  }
  const channel =
    channelText === "sms" || channelText === "http" ? channelText : "email";
  const host =
    appLocationHosts[hostLocations[hostText ?? "local"] ?? "this-machine"];
  const connectionSnippet = buildConnectionSnippets(language, {
    host,
    smtpPort: 1025,
    httpPort: 8025,
  }).find((snippet) => snippet.area === channelAreas[channel]);

  return {
    stack: stack.toLowerCase(),
    channel,
    host,
    language,
    code: connectionSnippet?.code ?? "",
  };
}
