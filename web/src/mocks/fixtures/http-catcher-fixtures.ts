import type {
  CapturedHttpRequest,
  HttpBin,
  HttpBinPreset,
  HttpResponseRule,
} from "@/lib/api/types";
import { readPresetDefaultResponse } from "@/lib/http/http-bin-presets";
import {
  createMockUlid,
  minutesAgo,
  minutesAgoInMs,
} from "@/mocks/fixtures/fixture-helpers";

const binSpecs: { name: string; preset: HttpBinPreset | null }[] = [
  { name: "slack", preset: "slack" },
  { name: "discord", preset: "discord" },
  { name: "push", preset: "fcm" },
  { name: "analytics", preset: null },
  { name: "uploads", preset: null },
];

/** Counts are filled in from the requests by the mock database. */
export function buildHttpBinFixtures(): HttpBin[] {
  return binSpecs.map((binSpec) => ({
    id: createMockUlid(),
    name: binSpec.name,
    preset: binSpec.preset,
    request_count: 0,
    last_request_at: null,
    default_response: readPresetDefaultResponse(binSpec.preset),
  }));
}

function buildRule(
  ruleFields: Partial<HttpResponseRule> & Pick<HttpResponseRule, "name">,
): HttpResponseRule {
  return {
    id: createMockUlid(),
    is_enabled: true,
    method: null,
    path_glob: "",
    filter: null,
    response: {
      status_code: 200,
      headers: { "content-type": "application/json" },
      body: '{"ok":true}',
    },
    delay_min_ms: 0,
    delay_max_ms: 0,
    failure_rate_percent: 0,
    failure_status_code: 500,
    ...ruleFields,
  };
}

/** Response rules by bin name (HC-02.1). */
export function buildHttpResponseRuleFixtures(): Record<
  string,
  HttpResponseRule[]
> {
  return {
    push: [
      buildRule({
        name: "Unregistered token",
        method: "POST",
        filter: { field: "body", operator: "contains", value: "expired-token" },
        response: {
          status_code: 404,
          headers: { "content-type": "application/json" },
          body: '{"error":{"code":404,"message":"Requested entity was not found.","status":"NOT_FOUND","details":[{"@type":"type.googleapis.com/google.firebase.fcm.v1.FcmError","errorCode":"UNREGISTERED"}]}}',
        },
      }),
    ],
    analytics: [
      buildRule({
        name: "Rate limited in test mode",
        method: "POST",
        path_glob: "/track",
        filter: {
          field: "header:x-test-mode",
          operator: "equals",
          value: "rate-limit",
        },
        response: {
          status_code: 429,
          headers: { "content-type": "application/json", "retry-after": "30" },
          body: '{"error":"rate_limited","event":{{ request.json.event | json }}}',
        },
      }),
      buildRule({
        name: "Slow batch import",
        path_glob: "/batch*",
        delay_min_ms: 500,
        delay_max_ms: 2000,
        failure_rate_percent: 10,
        failure_status_code: 503,
      }),
    ],
  };
}

const slackBlocksBody = JSON.stringify({
  text: "Email bounced",
  blocks: [
    { type: "header", text: { type: "plain_text", text: "Email bounced" } },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*unknown-user@example.com* did not get _Your verification code_.",
      },
      fields: [
        { type: "mrkdwn", text: "*Reason*\n550 5.1.1 user unknown" },
        { type: "mrkdwn", text: "*Provider*\nSendMock" },
      ],
    },
    { type: "divider" },
    {
      type: "context",
      elements: [{ type: "mrkdwn", text: "Sent by `acme-app` worker" }],
    },
    {
      type: "actions",
      elements: [
        { type: "button", text: { type: "plain_text", text: "Open email" } },
      ],
    },
  ],
});

const discordBody = JSON.stringify({
  username: "Acme Deploys",
  content: "Deploy finished",
  embeds: [
    {
      author: { name: "acme-ci" },
      title: "api v2.14.0 is live",
      description: "Rolled out to 3 of 3 regions in 4 minutes.",
      color: 5763719,
      fields: [
        { name: "Environment", value: "staging", inline: true },
        { name: "Commit", value: "a1b2c3d", inline: true },
      ],
      footer: { text: "Triggered by Rahim" },
    },
  ],
});

const multipartBoundary = "----sendmock-boundary";
const reportCsv = "user_id,plan\n42,pro\n43,free\n";
const multipartBody = [
  `--${multipartBoundary}`,
  'Content-Disposition: form-data; name="user_id"',
  "",
  "42",
  `--${multipartBoundary}`,
  'Content-Disposition: form-data; name="report"; filename="report.csv"',
  "Content-Type: text/csv",
  "",
  reportCsv,
  `--${multipartBoundary}--`,
].join("\r\n");

type RequestSpec = {
  binName: string;
  minutesAgo: number;
  method?: string;
  pathInBin: string;
  query?: Record<string, string>;
  headers?: Record<string, string>;
  body: string;
  contentType?: string;
  responseStatus?: number;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  matchedRuleName?: string;
  files?: CapturedHttpRequest["files"];
};

const requestSpecs: RequestSpec[] = [
  { binName: "slack", minutesAgo: 16, pathInBin: "", body: slackBlocksBody },
  {
    binName: "slack",
    minutesAgo: 33,
    pathInBin: "",
    body: '{"text":"SendMock test ping from *staging*"}',
  },
  { binName: "discord", minutesAgo: 20, pathInBin: "", body: discordBody },
  {
    binName: "push",
    minutesAgo: 26,
    pathInBin: "/v1/projects/acme/messages:send",
    body: '{"message":{"token":"device-token-7f3a","notification":{"title":"Order shipped","body":"Your order #10293 is on the way"}}}',
  },
  {
    binName: "push",
    minutesAgo: 48,
    pathInBin: "/v1/projects/acme/messages:send",
    body: '{"message":{"token":"expired-token-19c2","notification":{"title":"Welcome back","body":"We saved your cart"}}}',
    matchedRuleName: "Unregistered token",
  },
  {
    binName: "analytics",
    minutesAgo: 41,
    pathInBin: "/track",
    query: { source: "web" },
    headers: { "x-test-mode": "rate-limit" },
    body: '{"event":"signup","user_id":42}',
    matchedRuleName: "Rate limited in test mode",
  },
  {
    binName: "uploads",
    minutesAgo: 55,
    pathInBin: "/reports",
    body: multipartBody,
    contentType: `multipart/form-data; boundary=${multipartBoundary}`,
    files: [
      {
        file_index: 0,
        field_name: "report",
        filename: "report.csv",
        content_type: "text/csv",
        size_bytes: reportCsv.length,
      },
    ],
  },
];

/** Uploaded file contents by file name, for downloads (HC-01.2). */
export const fixtureFileContents: Record<string, string> = {
  "report.csv": reportCsv,
};

function buildRequestUrl(requestSpec: RequestSpec): string {
  const queryText = new URLSearchParams(requestSpec.query ?? {}).toString();
  const path = `/catch/${requestSpec.binName}${requestSpec.pathInBin}`;

  return `http://127.0.0.1:8025${path}${queryText === "" ? "" : `?${queryText}`}`;
}

/**
 * Captured requests with the reply template each one got; the mock database
 * renders the replies, as a capture would.
 */
export function buildCapturedHttpRequestFixtures(
  httpBins: HttpBin[],
  responseRulesByBinName: Record<string, HttpResponseRule[]>,
): CapturedHttpRequest[] {
  return requestSpecs.flatMap((requestSpec) => {
    const httpBin = httpBins.find((bin) => bin.name === requestSpec.binName);
    if (httpBin === undefined) {
      return [];
    }
    const matchedRule = (
      responseRulesByBinName[requestSpec.binName] ?? []
    ).find((responseRule) => responseRule.name === requestSpec.matchedRuleName);
    const sentResponse = matchedRule?.response ?? httpBin.default_response;
    const contentType = requestSpec.contentType ?? "application/json";

    return [
      {
        id: createMockUlid(minutesAgoInMs(requestSpec.minutesAgo)),
        bin_id: httpBin.id,
        bin_name: httpBin.name,
        method: requestSpec.method ?? "POST",
        url: buildRequestUrl(requestSpec),
        path: `/catch/${requestSpec.binName}${requestSpec.pathInBin}`,
        query: requestSpec.query ?? {},
        headers: {
          "content-type": contentType,
          "user-agent": "acme-app/1.0",
          ...requestSpec.headers,
        },
        body: requestSpec.body,
        content_type: contentType,
        files: requestSpec.files ?? [],
        client_ip: "172.17.0.1",
        response_status: sentResponse.status_code,
        response_headers: sentResponse.headers,
        response_body: sentResponse.body,
        matched_rule_id: matchedRule?.id ?? null,
        matched_rule_name: matchedRule?.name ?? null,
        is_simulated_failure: false,
        duration_ms: 2,
        created_at: minutesAgo(requestSpec.minutesAgo),
      },
    ];
  });
}
