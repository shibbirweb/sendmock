import type {
  MessageProviderArea,
  MessageProviderInput,
  MessageProviderPreview,
  ProviderDefinitionProblem,
  ProviderMessagePart,
  ProviderResponseTemplate,
  ProviderSampleRequest,
} from "@/lib/api/types";
import type { MockDatabase } from "@/mocks/db/mock-database";
import { mergeCredentials } from "@/mocks/payments/payment-gateway-record";
import { maskSecretValue } from "@/mocks/payments/render-gateway-templates";
import { buildSampleRequest } from "@/mocks/providers/build-sample-request";
import {
  findFailure,
  hasValidCredentials,
  type ProviderFailure,
} from "@/mocks/providers/check-provider-request";
import { findProviderRecord } from "@/mocks/providers/message-provider-record";
import {
  matchOperation,
  parseRequestBody,
  readSourceValues,
} from "@/mocks/providers/read-provider-request";
import { providerFieldDescriptions } from "@/mocks/providers/provider-field-descriptions";
import { buildContextReference } from "@/mocks/webhooks/build-template-reference";
import {
  renderTemplateText,
  type TemplateContext,
} from "@/mocks/webhooks/render-template-text";

function renderInto(
  templateText: string,
  templateContext: TemplateContext,
  partName: string,
  problems: ProviderDefinitionProblem[],
): string {
  const renderOutcome = renderTemplateText(templateText, templateContext);
  renderOutcome.errors.forEach((message) => {
    problems.push({ part: partName, message, severity: "error" });
  });
  renderOutcome.warnings.forEach((message) => {
    problems.push({ part: partName, message, severity: "warning" });
  });

  return renderOutcome.renderedText;
}

function renderResponse(
  responseTemplate: ProviderResponseTemplate,
  templateContext: TemplateContext,
  partName: string,
  problems: ProviderDefinitionProblem[],
): MessageProviderPreview["response"] {
  return {
    status: responseTemplate.status,
    headers: Object.fromEntries(
      responseTemplate.headers.map((headerTemplate) => [
        headerTemplate.name,
        renderInto(
          headerTemplate.template,
          templateContext,
          `${partName} header ${headerTemplate.name}`,
          problems,
        ),
      ]),
    ),
    body: renderInto(
      responseTemplate.body,
      templateContext,
      `${partName} body`,
      problems,
    ),
  };
}

/**
 * Runs a sample request through an unsaved provider: the message SendMock
 * would store and the answer it would give, with every problem named by its
 * part (EM-18.4, SM-16.4). Secrets are masked.
 */
export function previewMessageProvider(
  mockDatabase: Pick<MockDatabase, "messageProviders">,
  providerArea: MessageProviderArea,
  providerInput: MessageProviderInput,
  sampleRequest: ProviderSampleRequest = buildSampleRequest(
    providerArea,
    providerInput,
  ),
): MessageProviderPreview {
  const storedProvider = findProviderRecord(
    mockDatabase,
    providerArea,
    providerInput.key,
  );
  const renderedProvider: MessageProviderInput = {
    ...providerInput,
    credentials: mergeCredentials(
      storedProvider?.credentials ?? [],
      providerInput.credentials,
    ),
  };
  const problems: ProviderDefinitionProblem[] = [];
  const matchedOperation = matchOperation(
    renderedProvider.operations,
    sampleRequest,
  );
  const parsedBody = parseRequestBody(
    matchedOperation?.operation.request_format ?? "json",
    sampleRequest.body,
  );
  const partValues = new Map(
    renderedProvider.field_mapping.map((fieldMapping) => [
      fieldMapping.part,
      readSourceValues(parsedBody, fieldMapping.source),
    ]),
  );
  const readPart = (part: ProviderMessagePart) =>
    (partValues.get(part) ?? []).join(", ");
  const failure: ProviderFailure | undefined =
    matchedOperation === undefined
      ? {
          kind: "not_found",
          part: "path",
          reason: "No request matches this method and path",
        }
      : parsedBody === null
        ? {
            kind: "invalid_value",
            part: "body",
            reason: "The body is not valid JSON",
          }
        : !hasValidCredentials(renderedProvider, sampleRequest)
          ? {
              kind: "unauthorized",
              part: "credentials",
              reason: "The credentials do not match",
            }
          : findFailure(renderedProvider, partValues);
  const templateContext: TemplateContext = {
    request: {
      method: sampleRequest.method,
      path: sampleRequest.path,
      path_params: matchedOperation?.pathParams ?? {},
      headers: sampleRequest.headers,
      body: parsedBody ?? {},
    },
    message: {
      id: "01JB7T9Q2RPREVIEW000000000",
      provider_id: "",
      from: readPart("from"),
      to: readPart("to"),
      subject: readPart("subject"),
      body: readPart(providerArea === "email" ? "text" : "body"),
      status: "queued",
    },
    error: failure ?? { kind: "", part: "", reason: "" },
    credentials: Object.fromEntries(
      renderedProvider.credentials.map((credential) => [
        credential.name,
        credential.is_secret
          ? maskSecretValue(credential.value)
          : credential.value,
      ]),
    ),
  };
  const providerId = renderInto(
    renderedProvider.message_id_template,
    templateContext,
    "Message id",
    problems,
  );
  (templateContext.message as Record<string, unknown>).provider_id = providerId;
  const errorResponse = renderedProvider.error_responses.find(
    (candidate) => candidate.kind === failure?.kind,
  );
  const response =
    failure === undefined
      ? renderResponse(
          renderedProvider.success_response,
          templateContext,
          "Success response",
          problems,
        )
      : errorResponse === undefined
        ? {
            status: failure.kind === "not_found" ? 404 : 400,
            headers: {},
            body: JSON.stringify({ error: failure.reason }),
          }
        : renderResponse(
            errorResponse,
            templateContext,
            `${failure.kind} response`,
            problems,
          );

  return {
    operation_kind: matchedOperation?.operation.kind ?? null,
    stored_message:
      failure === undefined
        ? {
            from: readPart("from"),
            to: partValues.get("to") ?? [],
            subject:
              providerArea === "email" ? readPart("subject") || null : null,
            body:
              readPart(providerArea === "email" ? "text" : "body") ||
              readPart("html"),
            metadata: { provider_id: providerId },
          }
        : null,
    response,
    problems,
    reference: buildContextReference(
      templateContext,
      providerFieldDescriptions,
    ),
  };
}

/** Template errors in every response and the message id, which refuse a save. */
export function findProviderTemplateErrors(
  providerInput: MessageProviderInput,
): ProviderDefinitionProblem[] {
  const problems: ProviderDefinitionProblem[] = [];
  const emptyContext: TemplateContext = {
    request: { path_params: {}, headers: {}, body: {} },
    message: {},
    error: {},
    credentials: {},
  };
  renderInto(
    providerInput.message_id_template,
    emptyContext,
    "Message id",
    problems,
  );
  renderResponse(
    providerInput.success_response,
    emptyContext,
    "Success response",
    problems,
  );
  providerInput.error_responses.forEach((errorResponse) => {
    renderResponse(
      errorResponse,
      emptyContext,
      `${errorResponse.kind} response`,
      problems,
    );
  });

  return problems.filter((problem) => problem.severity === "error");
}
