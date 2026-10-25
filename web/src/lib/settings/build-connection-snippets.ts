import {
  buildHttpPostSnippet,
  type SnippetHeader,
} from "@/lib/settings/build-http-post-snippet";
import type { JsonValue } from "@/lib/settings/json-literals";

export const snippetLanguages = [
  "laravel",
  "node",
  "python",
  "go",
  "java",
  "ruby",
  "dotnet",
  "curl",
] as const;

export type SnippetLanguage = (typeof snippetLanguages)[number];

export const snippetLanguageLabels: Record<SnippetLanguage, string> = {
  laravel: "Laravel / PHP",
  node: "Node.js",
  python: "Python",
  go: "Go",
  java: "Java (Spring)",
  ruby: "Ruby (Rails)",
  dotnet: ".NET",
  curl: "cURL",
};

/** Where the user's app runs decides which host it uses to reach SendMock. */
export type AppLocation = "this-machine" | "docker-host" | "compose";

export const appLocationHosts: Record<AppLocation, string> = {
  "this-machine": "127.0.0.1",
  "docker-host": "host.docker.internal",
  compose: "sendmock",
};

export type ConnectionSnippet = {
  area: "smtp" | "email-api" | "sms" | "catcher";
  title: string;
  code: string;
};

type SnippetTarget = {
  host: string;
  smtpPort: number;
  httpPort: number;
};

/** The body the email snippet starts with; the editor can change it. */
export const sampleEmailRequestBody: JsonValue = {
  from: "app@app.test",
  to: ["user@example.com"],
  subject: "Hi",
  html: "<p>Hello</p>",
};

/** The body the SMS snippet starts with; the editor can change it. */
export const sampleSmsRequestBody: JsonValue = {
  from: "+15550001111",
  to: "+8801700000000",
  body: "Your code is 482913",
};

export type RequestCustomization = {
  requestHeaders: SnippetHeader[];
  emailRequestBody: JsonValue;
  smsRequestBody: JsonValue;
};

export const defaultRequestCustomization: RequestCustomization = {
  requestHeaders: [],
  emailRequestBody: sampleEmailRequestBody,
  smsRequestBody: sampleSmsRequestBody,
};

function buildSmtpSnippet(
  language: SnippetLanguage,
  { host, smtpPort }: SnippetTarget,
): string {
  const smtpSnippets: Record<SnippetLanguage, string> = {
    laravel: `MAIL_MAILER=smtp\nMAIL_HOST=${host}\nMAIL_PORT=${smtpPort}\nMAIL_ENCRYPTION=null`,
    node: `nodemailer.createTransport({ host: "${host}", port: ${smtpPort}, secure: false });`,
    python: `smtplib.SMTP("${host}", ${smtpPort})`,
    go: `smtp.SendMail("${host}:${smtpPort}", nil, from, to, message)`,
    java: `spring.mail.host=${host}\nspring.mail.port=${smtpPort}`,
    ruby: `config.action_mailer.smtp_settings = { address: "${host}", port: ${smtpPort} }`,
    dotnet: `client.Connect("${host}", ${smtpPort}, SecureSocketOptions.None);`,
    curl: `curl --url "smtp://${host}:${smtpPort}" --mail-from app@app.test \\\n  --mail-rcpt user@example.com --upload-file message.eml`,
  };

  return smtpSnippets[language];
}

/**
 * Copy-ready snippets for one language (PL-05.5), using the host for where
 * the app runs and the ports SendMock listens on.
 */
export function buildConnectionSnippets(
  language: SnippetLanguage,
  snippetTarget: SnippetTarget,
  requestCustomization: RequestCustomization = defaultRequestCustomization,
): ConnectionSnippet[] {
  const apiBaseUrl = `http://${snippetTarget.host}:${snippetTarget.httpPort}`;
  const { requestHeaders, emailRequestBody, smsRequestBody } =
    requestCustomization;

  return [
    {
      area: "smtp",
      title: "SMTP",
      code: buildSmtpSnippet(language, snippetTarget),
    },
    {
      area: "email-api",
      title: "Email API",
      code: buildHttpPostSnippet(language, {
        requestUrl: `${apiBaseUrl}/api/v1/send`,
        requestHeaders,
        requestBody: emailRequestBody,
      }),
    },
    {
      area: "sms",
      title: "SMS API",
      code: buildHttpPostSnippet(language, {
        requestUrl: `${apiBaseUrl}/api/v1/sms`,
        requestHeaders,
        requestBody: smsRequestBody,
      }),
    },
    {
      area: "catcher",
      title: "HTTP catcher (point Slack, push or other webhooks here)",
      code: `${apiBaseUrl}/catch/slack/services/T000/B000/XXXX`,
    },
  ];
}

/** "127.0.0.1:1025" to 1025, with a fallback when the address is missing. */
export function readPort(
  listenAddress: string | null,
  fallbackPort: number,
): number {
  const port = Number(listenAddress?.split(":").pop());

  return Number.isInteger(port) && port > 0 ? port : fallbackPort;
}
