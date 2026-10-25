import type {
  ManualSendRequest,
  RenderProblem,
  TemplateRenderRequest,
  WebhookEndpoint,
  WebhookEndpointInput,
  WebhookTemplateSummary,
} from "@/lib/api/types";
import { findRequestPart } from "@/lib/webhooks/describe-problem-source";

/** The request fields of a saved endpoint, without its id, stats or secret. */
export function pickEndpointInput(
  endpointSource: WebhookEndpointInput,
): WebhookEndpointInput {
  return {
    name: endpointSource.name,
    url: endpointSource.url,
    method: endpointSource.method,
    query_params: endpointSource.query_params,
    headers: endpointSource.headers,
    extra_fields: endpointSource.extra_fields,
    template_id: endpointSource.template_id,
    template_mode: endpointSource.template_mode,
    body_mode: endpointSource.body_mode,
    body_fields: endpointSource.body_fields,
    fields_encoding: endpointSource.fields_encoding,
    raw_content_type: endpointSource.raw_content_type,
    raw_body: endpointSource.raw_body,
    render_mode: endpointSource.render_mode,
    timeout_ms: endpointSource.timeout_ms,
    retry_policy: endpointSource.retry_policy,
    is_enabled: endpointSource.is_enabled,
  };
}

/**
 * The request a manual send renders: the composer's hand-written request
 * or the endpoint's, with the chosen template as its body for this send
 * (WH-05.1, WH-05.3).
 */
export function buildSendEndpointInput(
  endpointInput: WebhookEndpointInput,
  sendRequest: Pick<ManualSendRequest, "template_id" | "request">,
): WebhookEndpointInput {
  const baseInput = sendRequest.request ?? endpointInput;
  if (sendRequest.template_id === undefined) {
    return baseInput;
  }

  return {
    ...baseInput,
    body_mode: "template",
    template_id: sendRequest.template_id,
    template_mode: "linked",
    extra_fields: {},
  };
}

/**
 * Send-time values: Prompt answers, then overrides, which win (WH-05.5).
 * Rows without a name are skipped; a leading `vars.` is dropped.
 */
export function toSendVariables(
  promptValues: Record<string, string>,
  overrideValues: Record<string, string>,
): Record<string, string> {
  const namedOverrides = Object.entries(overrideValues).map(
    ([variableName, variableValue]) => [
      variableName.trim().replace(/^vars\./, ""),
      variableValue,
    ],
  );

  return {
    ...promptValues,
    ...Object.fromEntries(
      namedOverrides.filter(([variableName]) => variableName !== ""),
    ),
  };
}

/** Errors that would stop the send; an edited body replaces body errors (WH-05.6). */
export function findBlockingProblems(
  problems: RenderProblem[],
  isBodyEdited: boolean,
): RenderProblem[] {
  return problems.filter(
    (renderProblem) =>
      renderProblem.severity === "error" &&
      (!isBodyEdited || findRequestPart(renderProblem.source) !== "body"),
  );
}

/**
 * The endpoint Send to webhook starts with: the first one whose template
 * handles this kind of message (an SMS goes to an SMS template, a captured
 * request to an `http.*` one), else the first one.
 */
export function suggestSendEndpoint<Endpoint extends WebhookEndpoint>(
  webhookEndpoints: [Endpoint, ...Endpoint[]],
  webhookTemplates: WebhookTemplateSummary[],
  renderRequest: TemplateRenderRequest,
): Endpoint {
  let eventPrefix = "email.";
  if (renderRequest.sms_id !== undefined) {
    eventPrefix = "sms.";
  } else if (renderRequest.http_request_id !== undefined) {
    eventPrefix = "http.";
  }
  const fittingEndpoint = webhookEndpoints.find((webhookEndpoint) =>
    webhookTemplates
      .find(
        (webhookTemplate) => webhookTemplate.id === webhookEndpoint.template_id,
      )
      ?.events.some((eventType) => eventType.startsWith(eventPrefix)),
  );

  return fittingEndpoint ?? webhookEndpoints[0];
}
