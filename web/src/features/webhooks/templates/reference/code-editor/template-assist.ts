import {
  type Completion,
  type CompletionContext,
  type CompletionResult,
  pickedCompletion,
} from "@codemirror/autocomplete";
import type { EditorView } from "@codemirror/view";
import { hoverTooltip } from "@codemirror/view";

import type { TemplateReference } from "@/lib/api/types";
import {
  describeTemplateValue,
  findTemplateTokenAt,
} from "@/lib/webhooks/describe-template-value";
import {
  findSuggestionQuery,
  listTemplateSuggestions,
} from "@/lib/webhooks/template-suggestions";

type ReadReference = () => TemplateReference | undefined;

/** `{{` completion from the template reference, the same list as the text fields (WH-07.10). */
export function createTemplateCompletionSource(readReference: ReadReference) {
  return (completionContext: CompletionContext): CompletionResult | null => {
    const templateReference = readReference();
    const documentText = completionContext.state.doc.toString();
    const suggestionQuery = findSuggestionQuery(
      documentText,
      completionContext.pos,
    );
    if (templateReference === undefined || suggestionQuery === null) {
      return null;
    }

    const options: Completion[] = listTemplateSuggestions(
      templateReference,
      suggestionQuery,
    ).map((suggestion) => ({
      label: suggestion.label,
      detail: suggestion.detail,
      info: [
        suggestion.description,
        suggestion.example === null ? "" : `e.g. ${suggestion.example}`,
      ]
        .filter((infoLine) => infoLine !== "")
        .join("\n"),
      type: suggestion.suggestionKind === "field" ? "property" : "function",
      apply: (
        editorView: EditorView,
        completion: Completion,
        from: number,
        to: number,
      ) => {
        editorView.dispatch({
          changes: { from, to, insert: suggestion.insertText },
          selection: {
            anchor:
              from +
              suggestion.insertText.length -
              suggestion.cursorOffsetFromEnd,
          },
          annotations: pickedCompletion.of(completion),
        });
      },
    }));

    return {
      from: suggestionQuery.replaceFromIndex,
      options,
      filter: false,
    };
  };
}

function appendText(
  parentElement: HTMLElement,
  className: string,
  text: string,
) {
  const childElement = document.createElement("span");
  childElement.className = className;
  childElement.textContent = text;
  parentElement.append(childElement);
}

/** Hover over a value inside `{{ }}` to see its type, description and example. */
export function createValueHover(readReference: ReadReference) {
  return hoverTooltip((editorView, position) => {
    const templateReference = readReference();
    if (templateReference === undefined) {
      return null;
    }

    const documentLine = editorView.state.doc.lineAt(position);
    const templateToken = findTemplateTokenAt(
      documentLine.text,
      position - documentLine.from,
    );
    const valueDescription =
      templateToken === null
        ? null
        : describeTemplateValue(templateReference, templateToken.tokenText);
    if (templateToken === null || valueDescription === null) {
      return null;
    }

    return {
      pos: documentLine.from + templateToken.startIndex,
      end: documentLine.from + templateToken.endIndex,
      above: true,
      create: () => {
        const tooltipElement = document.createElement("div");
        tooltipElement.className = "cm-value-hover";
        tooltipElement.setAttribute("role", "tooltip");
        appendText(
          tooltipElement,
          "cm-value-hover-label",
          valueDescription.label,
        );
        appendText(
          tooltipElement,
          "cm-value-hover-detail",
          valueDescription.detail,
        );
        if (valueDescription.description !== "") {
          appendText(
            tooltipElement,
            "cm-value-hover-detail",
            valueDescription.description,
          );
        }
        if (
          valueDescription.example !== null &&
          valueDescription.example !== ""
        ) {
          appendText(
            tooltipElement,
            "cm-value-hover-detail",
            `e.g. ${valueDescription.example}`,
          );
        }
        return { dom: tooltipElement };
      },
    };
  });
}
