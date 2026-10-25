import { faker } from "@faker-js/faker/locale/en";

/** Values a template can read: `event`, `data`, `vars`, `endpoint`, ... */
export type TemplateContext = Record<string, unknown>;

type RenderOutcome = {
  renderedText: string;
  /** Undefined variables: they render empty. */
  warnings: string[];
  /** Unknown functions or filters and unbalanced braces: saving is refused. */
  errors: string[];
};

type RenderProblems = { warnings: string[]; errors: string[] };

const expressionPattern = /\{\{\s*([\s\S]+?)\s*\}\}/g;
const missingValue = Symbol("missing");
/** Missing, with a warning already given (an unknown function). */
const reportedMissingValue = Symbol("reported-missing");

/** "data.to[0].address" read from the context, or `missingValue`. */
function readPath(templateContext: TemplateContext, pathText: string): unknown {
  const pathParts = pathText.replace(/\[(\d+)\]/g, ".$1").split(".");
  let currentValue: unknown = templateContext;
  for (const pathPart of pathParts) {
    if (
      currentValue === null ||
      typeof currentValue !== "object" ||
      !(pathPart in currentValue)
    ) {
      return missingValue;
    }
    currentValue = (currentValue as Record<string, unknown>)[pathPart];
  }

  return currentValue === undefined || currentValue === null
    ? missingValue
    : currentValue;
}

/** Mock values for the built-in functions; signatures look real but are random. */
const templateFunctions: Record<string, (argumentTexts: string[]) => string> = {
  now_unix: () => String(Math.floor(Date.now() / 1000)),
  random_string: ([lengthText]) =>
    faker.string.alphanumeric(Number(lengthText) || 16),
  twilio_signature: () => `${faker.string.alphanumeric(27)}=`,
  mailgun_signature: () =>
    faker.string.hexadecimal({ length: 64, prefix: "" }).toLowerCase(),
  svix_signature: () => `v1,${faker.string.alphanumeric(43)}=`,
};

function stripEmailPrefix(eventType: string): string {
  return eventType.replace(/^email\./, "");
}

const templateFilters: Record<string, (filterInput: unknown) => unknown> = {
  json: (filterInput) => JSON.stringify(filterInput, null, 2),
  urlencode: (filterInput) => encodeURIComponent(String(filterInput)),
  lower: (filterInput) => String(filterInput).toLowerCase(),
  upper: (filterInput) => String(filterInput).toUpperCase(),
  sendgrid_event: (filterInput) => stripEmailPrefix(String(filterInput)),
  ses_type: (filterInput) => {
    const outcome = stripEmailPrefix(String(filterInput));
    return outcome.charAt(0).toUpperCase() + outcome.slice(1);
  },
  resend_type: (filterInput) =>
    `email.${stripEmailPrefix(String(filterInput))}`,
};

function splitTopLevel(text: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let isInString = false;
  let currentPart = "";
  for (const character of text) {
    if (character === '"') {
      isInString = !isInString;
    }
    if (!isInString && character === "(") {
      depth += 1;
    }
    if (!isInString && character === ")") {
      depth -= 1;
    }
    if (!isInString && depth === 0 && character === separator) {
      parts.push(currentPart.trim());
      currentPart = "";
      continue;
    }
    currentPart += character;
  }
  parts.push(currentPart.trim());

  return parts;
}

/** A string literal, a function call or a context path. */
function evaluateOperand(
  operandText: string,
  templateContext: TemplateContext,
  renderProblems: RenderProblems,
): unknown {
  const stringMatch = /^"(.*)"$/.exec(operandText);
  if (stringMatch !== null) {
    return stringMatch[1] ?? "";
  }

  const callMatch = /^([a-z_]+)\((.*)\)$/i.exec(operandText);
  if (callMatch !== null) {
    const functionName = callMatch[1] ?? "";
    const templateFunction = templateFunctions[functionName];
    if (templateFunction === undefined) {
      renderProblems.errors.push(`Unknown function: ${functionName}`);
      return reportedMissingValue;
    }

    return templateFunction(splitTopLevel(callMatch[2] ?? "", ","));
  }

  return readPath(templateContext, operandText);
}

function evaluateExpression(
  expressionText: string,
  templateContext: TemplateContext,
  renderProblems: RenderProblems,
): string {
  const [operandText = "", ...filterTexts] = splitTopLevel(expressionText, "|");
  let currentValue = evaluateOperand(
    operandText,
    templateContext,
    renderProblems,
  );
  let isDefaulted = false;

  for (const filterText of filterTexts) {
    const defaultMatch = /^default\((.*)\)$/.exec(filterText);
    if (defaultMatch !== null) {
      isDefaulted = true;
      if (
        currentValue === missingValue ||
        currentValue === reportedMissingValue ||
        currentValue === ""
      ) {
        currentValue = evaluateOperand(
          defaultMatch[1] ?? '""',
          templateContext,
          renderProblems,
        );
      }
      continue;
    }

    const templateFilter = templateFilters[filterText];
    if (templateFilter === undefined) {
      renderProblems.errors.push(`Unknown filter: ${filterText}`);
      continue;
    }
    if (
      currentValue !== missingValue &&
      currentValue !== reportedMissingValue
    ) {
      currentValue = templateFilter(currentValue);
    }
  }

  if (currentValue === reportedMissingValue) {
    return "";
  }
  if (currentValue === missingValue) {
    if (!isDefaulted) {
      renderProblems.warnings.push(`Undefined variable: ${operandText}`);
    }
    return "";
  }

  return typeof currentValue === "string" ? currentValue : String(currentValue);
}

/**
 * Renders `{{ ... }}` expressions leniently, as the preview does: an
 * undefined value renders empty and is reported as a warning (WH-08.4);
 * unknown names and unbalanced braces are errors (WH-09.7).
 * A small stand-in for the backend's template engine.
 */
export function renderTemplateText(
  templateText: string,
  templateContext: TemplateContext,
): RenderOutcome {
  const renderProblems: RenderProblems = { warnings: [], errors: [] };
  const renderedText = templateText.replace(
    expressionPattern,
    (_, expressionText: string) =>
      evaluateExpression(expressionText, templateContext, renderProblems),
  );
  // Braces left over after rendering were never closed or never opened.
  if (renderedText.includes("{{") || renderedText.includes("}}")) {
    renderProblems.errors.push(
      "Unbalanced {{ }}: every {{ needs a matching }}",
    );
  }

  return {
    renderedText,
    warnings: [...new Set(renderProblems.warnings)],
    errors: [...new Set(renderProblems.errors)],
  };
}
