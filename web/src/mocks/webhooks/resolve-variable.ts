import type {
  VariablePreviewRequest,
  VariablePreviewResult,
} from "@/lib/api/types";
import type { MockDatabase } from "@/mocks/db/mock-database";
import { buildTemplateContext } from "@/mocks/webhooks/build-template-context";
import { renderTemplateText } from "@/mocks/webhooks/render-template-text";

/** Kinds whose value is evaluated rather than used as written. */
const expressionKinds = new Set(["dynamic", "random"]);

/**
 * What a variable becomes against the sample email (WH-07.12): expressions
 * are evaluated, Computed templates rendered, secrets masked, the rest
 * used as written.
 */
export function resolveVariablePreview(
  mockDatabase: MockDatabase,
  previewRequest: VariablePreviewRequest,
): VariablePreviewResult {
  if (previewRequest.kind === "secret") {
    return { resolved_value: "••••••••", warnings: [], errors: [] };
  }
  if (
    !expressionKinds.has(previewRequest.kind) &&
    previewRequest.kind !== "computed"
  ) {
    return { resolved_value: previewRequest.value, warnings: [], errors: [] };
  }

  const builtContext = buildTemplateContext(
    mockDatabase,
    {
      id: "variable-preview",
      name: "Variable preview",
      service: "SendMock",
      category: "generic",
      source: "builtin",
      events: ["email.received"],
      description: "",
      required_variables: [],
      revision: 1,
      is_modified: false,
    },
    {},
  );
  const templateText = expressionKinds.has(previewRequest.kind)
    ? `{{ ${previewRequest.value} }}`
    : previewRequest.value;
  const renderOutcome = renderTemplateText(
    templateText,
    builtContext?.templateContext ?? {},
  );

  return {
    resolved_value: renderOutcome.renderedText,
    warnings: renderOutcome.warnings,
    errors: renderOutcome.errors,
  };
}
