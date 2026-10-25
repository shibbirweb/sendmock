import {
  acceptCompletion,
  autocompletion,
  closeCompletion,
  completionKeymap,
  completionStatus,
} from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { json } from "@codemirror/lang-json";
import { Annotation, Compartment, EditorState } from "@codemirror/state";
import {
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import * as React from "react";

import {
  codeEditorTheme,
  codeHighlighting,
  templateExpressionHighlighter,
} from "@/features/webhooks/templates/reference/code-editor/code-editor-theme";
import type { CodeEditorProps } from "@/features/webhooks/templates/reference/code-editor/code-editor-types";
import {
  problemUnderlines,
  setProblemsEffect,
} from "@/features/webhooks/templates/reference/code-editor/problem-underlines";
import {
  createTemplateCompletionSource,
  createValueHover,
} from "@/features/webhooks/templates/reference/code-editor/template-assist";
import { cn } from "@/lib/utils";

/** Marks a change that came from the `value` prop, so it is not reported back. */
const externalChange = Annotation.define<boolean>();

function toLanguageExtension(language: CodeEditorProps["language"]) {
  return language === "json" ? json() : [];
}

/**
 * The CodeMirror 6 editor for template bodies (WH-07.14): `{{ }}` and JSON
 * highlighting, `{{` completion, hover values and problem underlines.
 * Loaded lazily through `CodeEditor`.
 */
export default function CodeEditorView({
  value,
  onChange,
  ariaLabel,
  language,
  templateReference,
  problems = [],
  handleRef,
  isInvalid = false,
  minHeightClassName = "min-h-60",
}: CodeEditorProps) {
  const hostRef = React.useRef<HTMLDivElement | null>(null);
  const editorViewRef = React.useRef<EditorView | null>(null);
  const languageCompartment = React.useRef(new Compartment());
  const latestRef = React.useRef({ onChange, templateReference });
  React.useLayoutEffect(() => {
    latestRef.current = { onChange, templateReference };
  });

  React.useEffect(() => {
    const readReference = () => latestRef.current.templateReference;
    const editorView = new EditorView({
      parent: hostRef.current ?? undefined,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          highlightActiveLine(),
          highlightActiveLineGutter(),
          history(),
          autocompletion({
            override: [createTemplateCompletionSource(readReference)],
            icons: false,
            // Enter and Tab accept at once, like the template text fields.
            interactionDelay: 0,
          }),
          createValueHover(readReference),
          keymap.of([
            { key: "Tab", run: acceptCompletion },
            ...completionKeymap,
            ...defaultKeymap,
            ...historyKeymap,
          ]),
          // Same name as the text fields' list, so both read the same.
          EditorState.phrases.of({ Completions: "Suggestions" }),
          languageCompartment.current.of(toLanguageExtension(language)),
          codeHighlighting,
          templateExpressionHighlighter,
          problemUnderlines,
          codeEditorTheme,
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({
            "aria-label": ariaLabel,
            "aria-multiline": "true",
            role: "textbox",
            spellcheck: "false",
          }),
          EditorView.updateListener.of((viewUpdate) => {
            const isExternal = viewUpdate.transactions.some((transaction) =>
              transaction.annotation(externalChange),
            );
            if (viewUpdate.docChanged && !isExternal) {
              latestRef.current.onChange(viewUpdate.state.doc.toString());
            }
          }),
        ],
      }),
    });
    editorViewRef.current = editorView;

    return () => {
      editorView.destroy();
      editorViewRef.current = null;
    };
    // The editor is created once; later prop changes are dispatched below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    // Window capture runs before a surrounding dialog's Escape handling, so
    // Escape closes the suggestions without closing the dialog.
    const closeSuggestionsOnEscape = (keyboardEvent: KeyboardEvent) => {
      const editorView = editorViewRef.current;
      if (
        keyboardEvent.key !== "Escape" ||
        editorView === null ||
        !editorView.hasFocus ||
        completionStatus(editorView.state) === null
      ) {
        return;
      }
      closeCompletion(editorView);
      keyboardEvent.preventDefault();
      keyboardEvent.stopPropagation();
    };
    window.addEventListener("keydown", closeSuggestionsOnEscape, true);

    return () => {
      window.removeEventListener("keydown", closeSuggestionsOnEscape, true);
    };
  }, []);

  React.useEffect(() => {
    const editorView = editorViewRef.current;
    if (editorView !== null && editorView.state.doc.toString() !== value) {
      editorView.dispatch({
        changes: { from: 0, to: editorView.state.doc.length, insert: value },
        annotations: externalChange.of(true),
      });
    }
  }, [value]);

  React.useEffect(() => {
    editorViewRef.current?.dispatch({
      effects: languageCompartment.current.reconfigure(
        toLanguageExtension(language),
      ),
    });
  }, [language]);

  React.useEffect(() => {
    editorViewRef.current?.dispatch({
      effects: setProblemsEffect.of(problems),
    });
  }, [problems]);

  React.useImperativeHandle(handleRef, () => ({
    insertText: (insertText: string) => {
      const editorView = editorViewRef.current;
      if (editorView === null) {
        return;
      }
      // Focus first: focusing afterwards would bring back the old caret.
      editorView.focus();
      const { from, to } = editorView.state.selection.main;
      editorView.dispatch({
        changes: { from, to, insert: insertText },
        selection: { anchor: from + insertText.length },
        scrollIntoView: true,
      });
    },
  }));

  return (
    <div
      ref={hostRef}
      data-invalid={isInvalid || undefined}
      className={cn(
        "grid overflow-hidden rounded-md border bg-transparent shadow-xs focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 data-[invalid]:border-destructive [&_.cm-editor]:min-h-full",
        minHeightClassName,
      )}
    />
  );
}
