import { StateEffect, StateField, type Text } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView } from "@codemirror/view";

import type { CodeEditorProblem } from "@/features/webhooks/templates/reference/code-editor/code-editor-types";

export const setProblemsEffect = StateEffect.define<CodeEditorProblem[]>();

/** The text a problem points at: its `{{ ... }}`, or two characters. */
function findProblemRange(
  documentText: Text,
  problem: CodeEditorProblem,
): { from: number; to: number } | null {
  if (documentText.length === 0) {
    return null;
  }

  const lineNumber = Math.min(Math.max(problem.line, 1), documentText.lines);
  const documentLine = documentText.line(lineNumber);
  const from = Math.min(
    documentLine.from + problem.column - 1,
    documentLine.to,
  );
  const closingIndex = documentLine.text.indexOf(
    "}}",
    from - documentLine.from,
  );
  const to =
    closingIndex === -1
      ? Math.min(from + 2, documentLine.to)
      : documentLine.from + closingIndex + 2;
  if (to > from) {
    return { from, to };
  }

  return from > 0 ? { from: from - 1, to: from } : { from, to: from + 1 };
}

function buildProblemDecorations(
  documentText: Text,
  problems: CodeEditorProblem[],
): DecorationSet {
  const problemMarks = problems.flatMap((problem) => {
    const problemRange = findProblemRange(documentText, problem);
    if (problemRange === null) {
      return [];
    }

    return [
      Decoration.mark({
        class: `cm-problem-${problem.severity}`,
        attributes: { title: problem.message, "data-problem": problem.message },
      }).range(problemRange.from, problemRange.to),
    ];
  });

  return Decoration.set(problemMarks, true);
}

/** Underlines render problems at their line and column (WH-07.15). */
export const problemUnderlines = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(problemDecorations, transaction) {
    let nextDecorations = problemDecorations.map(transaction.changes);
    for (const effect of transaction.effects) {
      if (effect.is(setProblemsEffect)) {
        nextDecorations = buildProblemDecorations(
          transaction.state.doc,
          effect.value,
        );
      }
    }

    return nextDecorations;
  },
  provide: (problemField) => EditorView.decorations.from(problemField),
});
