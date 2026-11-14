import * as React from "react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SuggestionList } from "@/features/webhooks/templates/reference/suggestion-list";
import type { TemplateReference } from "@/lib/api/types";
import { measureCaretPosition } from "@/lib/dom/measure-caret-position";
import {
  applyTemplateSuggestion,
  findSuggestionQuery,
  listTemplateSuggestions,
  type SuggestionQuery,
  type TemplateSuggestion,
} from "@/lib/webhooks/template-suggestions";
import { cn } from "@/lib/utils";

type TemplateField = HTMLTextAreaElement | HTMLInputElement;

/** An expression field reads as if it sat inside `{{ ` so the same rules apply. */
const expressionPrefix = "{{ ";

function findFieldSuggestionQuery(
  fieldText: string,
  cursorIndex: number,
  isExpression: boolean,
): SuggestionQuery | null {
  if (!isExpression) {
    return findSuggestionQuery(fieldText, cursorIndex);
  }

  const prefixedQuery = findSuggestionQuery(
    expressionPrefix + fieldText,
    cursorIndex + expressionPrefix.length,
  );

  return prefixedQuery === null
    ? null
    : {
        ...prefixedQuery,
        replaceFromIndex:
          prefixedQuery.replaceFromIndex - expressionPrefix.length,
      };
}

type OpenSuggestions = {
  suggestionQuery: SuggestionQuery;
  suggestions: TemplateSuggestion[];
  activeIndex: number;
  position: { top: number; left: number };
};

/**
 * A textarea or input for template text that suggests keys, filters and
 * functions while typing inside `{{ }}` (WH-07.10). Without a reference it
 * is a plain field.
 */
export function TemplateTextField({
  fieldId,
  value,
  onChange,
  templateReference,
  isMultiline = false,
  rows,
  ariaLabel,
  isInvalid = false,
  placeholder,
  className,
  fieldRef,
  isExpression = false,
}: {
  fieldId?: string;
  value: string;
  onChange: (nextValue: string) => void;
  templateReference: TemplateReference | undefined;
  isMultiline?: boolean;
  rows?: number;
  ariaLabel?: string;
  isInvalid?: boolean;
  placeholder?: string;
  className?: string;
  /** Lets a parent insert text at the caret, e.g. from the reference panel. */
  fieldRef?: React.RefObject<TemplateField | null>;
  /** The whole field is one expression (no `{{ }}`), e.g. a Dynamic variable. */
  isExpression?: boolean;
}) {
  const listId = React.useId();
  const ownFieldRef = React.useRef<TemplateField | null>(null);
  const textFieldRef = fieldRef ?? ownFieldRef;
  const pendingCursorRef = React.useRef<number | null>(null);
  const [openSuggestions, setOpenSuggestions] =
    React.useState<OpenSuggestions | null>(null);

  React.useLayoutEffect(() => {
    const textField = textFieldRef.current;
    if (textField !== null && pendingCursorRef.current !== null) {
      textField.setSelectionRange(
        pendingCursorRef.current,
        pendingCursorRef.current,
      );
      pendingCursorRef.current = null;
    }
  }, [value, textFieldRef]);

  const refreshSuggestions = (textField: TemplateField) => {
    const cursorIndex = textField.selectionStart ?? textField.value.length;
    const suggestionQuery =
      templateReference === undefined
        ? null
        : findFieldSuggestionQuery(textField.value, cursorIndex, isExpression);
    const suggestions =
      suggestionQuery === null || templateReference === undefined
        ? []
        : listTemplateSuggestions(templateReference, suggestionQuery);
    if (suggestionQuery === null || suggestions.length === 0) {
      setOpenSuggestions(null);
      return;
    }

    const caretPosition = measureCaretPosition(textField, cursorIndex);
    setOpenSuggestions({
      suggestionQuery,
      suggestions,
      activeIndex: 0,
      position: {
        top:
          textField.offsetTop +
          caretPosition.top +
          caretPosition.lineHeight +
          4,
        left: textField.offsetLeft + caretPosition.left,
      },
    });
  };

  const pickSuggestion = (pickedSuggestion: TemplateSuggestion) => {
    const textField = textFieldRef.current;
    if (textField === null || openSuggestions === null) {
      return;
    }

    const { nextText, nextCursorIndex } = applyTemplateSuggestion(
      textField.value,
      textField.selectionStart ?? textField.value.length,
      openSuggestions.suggestionQuery,
      pickedSuggestion,
    );
    pendingCursorRef.current = nextCursorIndex;
    setOpenSuggestions(null);
    onChange(nextText);
  };

  const handleKeyDown = (keyboardEvent: React.KeyboardEvent<TemplateField>) => {
    if (openSuggestions === null) {
      return;
    }

    const suggestionCount = openSuggestions.suggestions.length;
    if (keyboardEvent.key === "ArrowDown" || keyboardEvent.key === "ArrowUp") {
      keyboardEvent.preventDefault();
      const step = keyboardEvent.key === "ArrowDown" ? 1 : -1;
      setOpenSuggestions({
        ...openSuggestions,
        activeIndex:
          (openSuggestions.activeIndex + step + suggestionCount) %
          suggestionCount,
      });
    } else if (keyboardEvent.key === "Enter" || keyboardEvent.key === "Tab") {
      keyboardEvent.preventDefault();
      const activeSuggestion =
        openSuggestions.suggestions[openSuggestions.activeIndex];
      if (activeSuggestion !== undefined) {
        pickSuggestion(activeSuggestion);
      }
    } else if (keyboardEvent.key === "Escape") {
      keyboardEvent.preventDefault();
      keyboardEvent.stopPropagation();
      setOpenSuggestions(null);
    }
  };

  const sharedProps = {
    id: fieldId,
    value,
    placeholder,
    spellCheck: false,
    "aria-label": ariaLabel,
    "aria-invalid": isInvalid,
    "aria-autocomplete": "list" as const,
    "aria-expanded": openSuggestions !== null,
    "aria-controls": openSuggestions === null ? undefined : listId,
    "aria-activedescendant":
      openSuggestions === null
        ? undefined
        : `${listId}-${openSuggestions.activeIndex}`,
    className: cn("font-mono text-xs", className),
    onKeyDown: handleKeyDown,
    onKeyUp: (keyboardEvent: React.KeyboardEvent<TemplateField>) => {
      if (
        ["ArrowLeft", "ArrowRight", "Home", "End"].includes(keyboardEvent.key)
      ) {
        refreshSuggestions(keyboardEvent.currentTarget);
      }
    },
    onClick: (mouseEvent: React.MouseEvent<TemplateField>) => {
      refreshSuggestions(mouseEvent.currentTarget);
    },
    onBlur: () => {
      setOpenSuggestions(null);
    },
  };

  return (
    <div className="relative">
      {isMultiline ? (
        <Textarea
          {...sharedProps}
          ref={textFieldRef as React.RefObject<HTMLTextAreaElement>}
          rows={rows}
          onChange={(changeEvent) => {
            onChange(changeEvent.target.value);
            refreshSuggestions(changeEvent.target);
          }}
        />
      ) : (
        <Input
          {...sharedProps}
          ref={textFieldRef as React.RefObject<HTMLInputElement>}
          onChange={(changeEvent) => {
            onChange(changeEvent.target.value);
            refreshSuggestions(changeEvent.target);
          }}
        />
      )}
      {openSuggestions !== null && (
        <SuggestionList
          listId={listId}
          suggestions={openSuggestions.suggestions}
          activeIndex={openSuggestions.activeIndex}
          position={openSuggestions.position}
          onPick={pickSuggestion}
          onHover={(hoveredIndex) => {
            setOpenSuggestions({
              ...openSuggestions,
              activeIndex: hoveredIndex,
            });
          }}
        />
      )}
    </div>
  );
}

/**
 * True while the focused field shows suggestions. Sheets check this on
 * Escape (which they see first) so Escape closes the popup, not the sheet.
 */
export function isSuggestionPopupOpen(): boolean {
  const focusedElement = document.activeElement;

  if (focusedElement?.getAttribute("aria-autocomplete") !== "list") {
    return false;
  }

  // The code editor marks an open list with aria-controls instead.
  return (
    focusedElement.getAttribute("aria-expanded") === "true" ||
    (focusedElement.getAttribute("aria-haspopup") === "listbox" &&
      focusedElement.hasAttribute("aria-controls"))
  );
}
