import type {
  TemplateReference,
  TemplateReferenceField,
  TemplateReferenceHelper,
} from "@/lib/api/types";

/** What is being typed at the cursor inside `{{ }}`, and the text it replaces. */
export type SuggestionQuery = {
  queryKind: "path" | "filter";
  typedText: string;
  replaceFromIndex: number;
};

export type TemplateSuggestion = {
  suggestionKind: "field" | "function" | "filter";
  label: string;
  insertText: string;
  /** Where the cursor lands, counted back from the end of the inserted text. */
  cursorOffsetFromEnd: number;
  detail: string;
  description: string;
  example: string | null;
};

const suggestionLimit = 30;
const pathTokenPattern = /[A-Za-z0-9_.[\]]*$/;
const filterTokenPattern = /[A-Za-z0-9_]*$/;

/** The open `{{ ... ` the cursor sits in, or null outside an expression (WH-07.10). */
export function findSuggestionQuery(
  templateText: string,
  cursorIndex: number,
): SuggestionQuery | null {
  const textBeforeCursor = templateText.slice(0, cursorIndex);
  const openIndex = textBeforeCursor.lastIndexOf("{{");
  if (openIndex === -1 || textBeforeCursor.indexOf("}}", openIndex) !== -1) {
    return null;
  }

  const expressionText = textBeforeCursor.slice(openIndex + 2);
  const pipeIndex = expressionText.lastIndexOf("|");
  if (pipeIndex !== -1) {
    const typedText =
      filterTokenPattern.exec(expressionText.slice(pipeIndex + 1))?.[0] ?? "";
    const isRightAfterPipe = /^\s*[A-Za-z0-9_]*$/.test(
      expressionText.slice(pipeIndex + 1),
    );
    if (isRightAfterPipe) {
      return {
        queryKind: "filter",
        typedText,
        replaceFromIndex: cursorIndex - typedText.length,
      };
    }
    return null;
  }

  const typedText = pathTokenPattern.exec(expressionText)?.[0] ?? "";

  return {
    queryKind: "path",
    typedText,
    replaceFromIndex: cursorIndex - typedText.length,
  };
}

type FlatField = { field: TemplateReferenceField; parentPath: string };

function flattenFields(
  fields: TemplateReferenceField[],
  parentPath = "",
): FlatField[] {
  return fields.flatMap((field) => [
    { field, parentPath },
    ...flattenFields(field.children, field.path),
  ]);
}

function toFieldSuggestion(field: TemplateReferenceField): TemplateSuggestion {
  return {
    suggestionKind: "field",
    label: field.path,
    insertText: field.path,
    cursorOffsetFromEnd: 0,
    detail: field.value_type,
    description: field.description,
    example: field.example,
  };
}

function toHelperSuggestion(
  helper: TemplateReferenceHelper,
  suggestionKind: "function" | "filter",
): TemplateSuggestion {
  const takesArguments =
    suggestionKind === "function" || helper.signature.includes("(");

  return {
    suggestionKind,
    label: helper.name,
    insertText: takesArguments ? `${helper.name}()` : helper.name,
    cursorOffsetFromEnd: takesArguments ? 1 : 0,
    detail: helper.signature,
    description: helper.description,
    example: helper.example,
  };
}

function startsWithIgnoringCase(text: string, prefix: string): boolean {
  return text.toLowerCase().startsWith(prefix.toLowerCase());
}

/**
 * Suggestions for what is typed: the fields one level below the last dot
 * (and the children of an exact match), functions at the top level, and
 * filters after `|` (WH-07.10).
 */
export function listTemplateSuggestions(
  templateReference: TemplateReference,
  suggestionQuery: SuggestionQuery,
): TemplateSuggestion[] {
  const { typedText } = suggestionQuery;
  if (suggestionQuery.queryKind === "filter") {
    return templateReference.filters
      .filter((filterHelper) =>
        startsWithIgnoringCase(filterHelper.name, typedText),
      )
      .map((filterHelper) => toHelperSuggestion(filterHelper, "filter"));
  }

  const flatFields = flattenFields(templateReference.fields);
  const lastDotIndex = typedText.lastIndexOf(".");
  const parentPath =
    lastDotIndex === -1 ? "" : typedText.slice(0, lastDotIndex);
  const siblingFields = flatFields
    .filter(
      ({ field, parentPath: fieldParent }) =>
        fieldParent === parentPath &&
        startsWithIgnoringCase(field.path, typedText),
    )
    .map(({ field }) => field);
  const exactField = flatFields.find(
    ({ field }) => field.path === typedText,
  )?.field;
  const childFields = exactField?.children ?? [];
  const functionSuggestions =
    lastDotIndex === -1
      ? templateReference.functions
          .filter((functionHelper) =>
            startsWithIgnoringCase(functionHelper.name, typedText),
          )
          .map((functionHelper) =>
            toHelperSuggestion(functionHelper, "function"),
          )
      : [];

  return [
    ...siblingFields
      .filter((field) => field.path !== typedText)
      .map(toFieldSuggestion),
    ...childFields.map(toFieldSuggestion),
    ...functionSuggestions,
  ].slice(0, suggestionLimit);
}

/** The template with a suggestion put in place of what was typed, and where the cursor goes. */
export function applyTemplateSuggestion(
  templateText: string,
  cursorIndex: number,
  suggestionQuery: SuggestionQuery,
  templateSuggestion: TemplateSuggestion,
): { nextText: string; nextCursorIndex: number } {
  const nextText =
    templateText.slice(0, suggestionQuery.replaceFromIndex) +
    templateSuggestion.insertText +
    templateText.slice(cursorIndex);
  const insertedEndIndex =
    suggestionQuery.replaceFromIndex + templateSuggestion.insertText.length;

  return {
    nextText,
    nextCursorIndex: insertedEndIndex - templateSuggestion.cursorOffsetFromEnd,
  };
}
