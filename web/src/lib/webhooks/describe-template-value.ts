import type {
  TemplateReference,
  TemplateReferenceField,
} from "@/lib/api/types";

export type TemplateValueDescription = {
  label: string;
  detail: string;
  description: string;
  example: string | null;
};

const tokenCharacterPattern = /[A-Za-z0-9_.[\]]/;

/**
 * The value or helper name under the cursor when it sits inside `{{ }}` on
 * the same line, with where it starts and ends; null elsewhere.
 */
export function findTemplateTokenAt(
  lineText: string,
  cursorIndex: number,
): { tokenText: string; startIndex: number; endIndex: number } | null {
  const openIndex = lineText.lastIndexOf("{{", cursorIndex);
  const closeIndex = lineText.indexOf("}}", openIndex);
  if (openIndex === -1 || closeIndex === -1 || cursorIndex > closeIndex) {
    return null;
  }

  let startIndex = cursorIndex;
  while (
    startIndex > 0 &&
    tokenCharacterPattern.test(lineText[startIndex - 1] ?? "")
  ) {
    startIndex -= 1;
  }
  let endIndex = cursorIndex;
  while (
    endIndex < lineText.length &&
    tokenCharacterPattern.test(lineText[endIndex] ?? "")
  ) {
    endIndex += 1;
  }
  const tokenText = lineText.slice(startIndex, endIndex);

  return tokenText === "" ? null : { tokenText, startIndex, endIndex };
}

function findField(
  fields: TemplateReferenceField[],
  fieldPath: string,
): TemplateReferenceField | undefined {
  for (const field of fields) {
    if (field.path === fieldPath) {
      return field;
    }
    const childMatch = findField(field.children, fieldPath);
    if (childMatch !== undefined) {
      return childMatch;
    }
  }

  return undefined;
}

/**
 * What a hovered value is, from the template reference: its type,
 * description and example (secrets arrive masked). Helpers are matched by
 * name.
 */
export function describeTemplateValue(
  templateReference: TemplateReference,
  tokenText: string,
): TemplateValueDescription | null {
  const field = findField(templateReference.fields, tokenText);
  if (field !== undefined) {
    return {
      label: field.path,
      detail: field.value_type,
      description: field.description,
      example: field.example,
    };
  }

  const helper = [
    ...templateReference.functions,
    ...templateReference.filters,
  ].find((templateHelper) => templateHelper.name === tokenText);

  return helper === undefined
    ? null
    : {
        label: helper.name,
        detail: helper.signature,
        description: helper.description,
        example: helper.example,
      };
}
