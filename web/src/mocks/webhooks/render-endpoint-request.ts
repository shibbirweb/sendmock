import type {
  EndpointBodyField,
  EndpointPreviewRequest,
  EndpointPreviewResult,
  RenderProblem,
  WebhookEndpointInput,
} from "@/lib/api/types";
import {
  findTemplateDefinition,
  type MockDatabase,
} from "@/mocks/db/mock-database";
import { buildTemplateContext } from "@/mocks/webhooks/build-template-context";
import { foldEndpointOverrides } from "@/mocks/webhooks/fold-endpoint-overrides";
import { toRenderProblems } from "@/mocks/webhooks/render-template-definition";
import {
  renderTemplateText,
  type TemplateContext,
} from "@/mocks/webhooks/render-template-text";

type RenderedPart = { renderedText: string; problems: RenderProblem[] };

function renderPart(
  templateText: string,
  templateContext: TemplateContext,
  source: string,
): RenderedPart {
  const renderOutcome = renderTemplateText(templateText, templateContext);

  return {
    renderedText: renderOutcome.renderedText,
    problems: toRenderProblems(renderOutcome.locatedProblems, source),
  };
}

/** "user.email" = x becomes { user: { email: x } }. */
function setNestedValue(
  targetObject: Record<string, unknown>,
  dottedName: string,
  fieldValue: unknown,
) {
  const nameParts = dottedName.split(".");
  let currentObject = targetObject;
  for (const namePart of nameParts.slice(0, -1)) {
    const nextObject = currentObject[namePart];
    currentObject[namePart] =
      nextObject !== null && typeof nextObject === "object" ? nextObject : {};
    currentObject = currentObject[namePart] as Record<string, unknown>;
  }
  currentObject[nameParts.at(-1) ?? dottedName] = fieldValue;
}

/** A rendered field value as its type; a value that does not fit is reported (WH-07.14). */
function toTypedValue(
  bodyField: EndpointBodyField,
  renderedValue: string,
  source: string,
  problems: RenderProblem[],
): unknown {
  const reportTypeProblem = (message: string) => {
    problems.push({
      message,
      severity: "error",
      source,
      line: null,
      column: null,
    });
  };
  if (bodyField.value_type === "number") {
    if (
      renderedValue.trim() === "" ||
      !Number.isFinite(Number(renderedValue))
    ) {
      reportTypeProblem(
        `${bodyField.name} renders "${renderedValue}", which is not a number`,
      );
      return renderedValue;
    }
    return Number(renderedValue);
  }
  if (bodyField.value_type === "boolean") {
    if (renderedValue !== "true" && renderedValue !== "false") {
      reportTypeProblem(
        `${bodyField.name} renders "${renderedValue}"; use true or false`,
      );
    }
    return renderedValue === "true";
  }
  if (bodyField.value_type === "json") {
    try {
      return JSON.parse(renderedValue) as unknown;
    } catch {
      reportTypeProblem(`${bodyField.name} does not render valid JSON`);
      return renderedValue;
    }
  }

  return renderedValue;
}

function renderFieldsBody(
  endpointInput: WebhookEndpointInput,
  templateContext: TemplateContext,
  problems: RenderProblem[],
) {
  const renderedFields = endpointInput.body_fields.map(
    (bodyField, fieldIndex) => {
      const renderedPart = renderPart(
        bodyField.value,
        templateContext,
        `field.${fieldIndex}`,
      );
      problems.push(...renderedPart.problems);
      return {
        bodyField,
        renderedValue: renderedPart.renderedText,
        source: `field.${fieldIndex}`,
      };
    },
  );
  if (endpointInput.fields_encoding === "form") {
    return {
      contentType: "application/x-www-form-urlencoded",
      body: new URLSearchParams(
        renderedFields.map(({ bodyField, renderedValue }) => [
          bodyField.name,
          renderedValue,
        ]),
      ).toString(),
    };
  }

  const jsonBody: Record<string, unknown> = {};
  for (const { bodyField, renderedValue, source } of renderedFields) {
    setNestedValue(
      jsonBody,
      bodyField.name,
      toTypedValue(bodyField, renderedValue, source, problems),
    );
  }

  return {
    contentType: "application/json",
    body: JSON.stringify(jsonBody, null, 2),
  };
}

function renderBody(
  mockDatabase: MockDatabase,
  endpointInput: WebhookEndpointInput,
  templateContext: TemplateContext,
  problems: RenderProblem[],
) {
  if (endpointInput.body_mode === "none") {
    return { contentType: null, body: "", templateHeaders: {} };
  }
  if (endpointInput.body_mode === "fields") {
    return {
      ...renderFieldsBody(endpointInput, templateContext, problems),
      templateHeaders: {},
    };
  }
  if (endpointInput.body_mode === "raw") {
    const renderedRaw = renderPart(
      endpointInput.raw_body,
      templateContext,
      "body",
    );
    problems.push(...renderedRaw.problems);
    if (endpointInput.raw_content_type.includes("json")) {
      try {
        JSON.parse(renderedRaw.renderedText);
      } catch {
        problems.push({
          message: "The rendered body is not valid JSON",
          severity: "warning",
          source: "body",
          line: null,
          column: null,
        });
      }
    }
    return {
      contentType: endpointInput.raw_content_type,
      body: renderedRaw.renderedText,
      templateHeaders: {},
    };
  }

  const templateDefinition = foldEndpointOverrides(
    findTemplateDefinition(mockDatabase, endpointInput.template_id),
    {},
    endpointInput.extra_fields,
  );
  const renderedTemplateBody = renderPart(
    templateDefinition.body_template,
    templateContext,
    "body",
  );
  problems.push(...renderedTemplateBody.problems);
  const templateHeaders = Object.fromEntries(
    Object.entries(templateDefinition.header_templates).map(
      ([headerName, headerTemplate]) => [
        headerName,
        renderPart(headerTemplate, templateContext, "body").renderedText,
      ],
    ),
  );

  return {
    contentType: templateDefinition.content_type,
    body: renderedTemplateBody.renderedText,
    templateHeaders,
  };
}

/**
 * The request an endpoint would send for the sample or a chosen message
 * (WH-07.15). Strict mode turns undefined values into errors, since such a
 * delivery would stop as render_failed.
 */
export function renderEndpointRequest(
  mockDatabase: MockDatabase,
  previewRequest: EndpointPreviewRequest,
): EndpointPreviewResult | null {
  const endpointInput = previewRequest.endpoint;
  const templateEvents = mockDatabase.webhookTemplates.find(
    (webhookTemplate) => webhookTemplate.id === endpointInput.template_id,
  )?.events;
  const builtContext = buildTemplateContext(
    mockDatabase,
    {
      id: "endpoint-preview",
      name: endpointInput.name,
      service: "SendMock",
      category: "generic",
      source: "builtin",
      events:
        endpointInput.body_mode === "template" && templateEvents !== undefined
          ? templateEvents
          : ["email.received"],
      description: "",
      required_variables: [],
      revision: 1,
      is_modified: false,
    },
    { email_id: previewRequest.email_id, sms_id: previewRequest.sms_id },
  );
  if (builtContext === null) {
    return null;
  }

  const endpointVariables = Object.fromEntries(
    mockDatabase.webhookVariables
      .filter(
        (webhookVariable) =>
          previewRequest.endpoint_id !== undefined &&
          webhookVariable.endpoint_id === previewRequest.endpoint_id,
      )
      .map((webhookVariable) => [webhookVariable.name, webhookVariable.value]),
  );
  const templateContext: TemplateContext = {
    ...builtContext.templateContext,
    vars: {
      ...(builtContext.templateContext.vars as Record<string, unknown>),
      ...endpointVariables,
    },
    endpoint: { name: endpointInput.name, url: endpointInput.url },
  };
  const problems: RenderProblem[] = [];
  const renderedUrl = renderPart(endpointInput.url, templateContext, "url");
  problems.push(...renderedUrl.problems);
  const queryPairs = endpointInput.query_params.map(
    (queryParam, queryIndex) => {
      const renderedValue = renderPart(
        queryParam.value,
        templateContext,
        `query.${queryIndex}`,
      );
      problems.push(...renderedValue.problems);
      return `${encodeURIComponent(queryParam.name)}=${encodeURIComponent(renderedValue.renderedText)}`;
    },
  );
  const renderedBody = renderBody(
    mockDatabase,
    endpointInput,
    templateContext,
    problems,
  );
  const renderedHeaders = Object.entries(endpointInput.headers).map(
    ([headerName, headerTemplate], headerIndex) => {
      const renderedHeader = renderPart(
        headerTemplate,
        templateContext,
        `header.${headerIndex}`,
      );
      problems.push(...renderedHeader.problems);
      return [headerName, renderedHeader.renderedText];
    },
  );
  const separator = renderedUrl.renderedText.includes("?") ? "&" : "?";

  return {
    rendered_against: builtContext.renderedAgainst,
    method: endpointInput.method,
    url:
      queryPairs.length === 0
        ? renderedUrl.renderedText
        : `${renderedUrl.renderedText}${separator}${queryPairs.join("&")}`,
    headers: {
      ...(renderedBody.contentType === null
        ? {}
        : { "content-type": renderedBody.contentType }),
      ...renderedBody.templateHeaders,
      ...Object.fromEntries(renderedHeaders),
    },
    body: renderedBody.body,
    problems:
      endpointInput.render_mode === "strict"
        ? problems.map((problem) =>
            problem.message.startsWith("Undefined variable")
              ? { ...problem, severity: "error" }
              : problem,
          )
        : problems,
  };
}
