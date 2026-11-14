import type * as React from "react";

import type { TemplateReference } from "@/lib/api/types";

/** A render problem at its 1-based line and column, underlined in the editor. */
export type CodeEditorProblem = {
  message: string;
  severity: "error" | "warning";
  line: number;
  column: number;
};

/** Lets a parent insert text at the caret, e.g. from the Insert menu. */
export type CodeEditorHandle = {
  insertText: (insertText: string) => void;
};

export type CodeEditorProps = {
  value: string;
  onChange: (nextValue: string) => void;
  ariaLabel: string;
  /** JSON adds JSON highlighting; `{{ }}` is highlighted either way. */
  language: "json" | "text";
  templateReference: TemplateReference | undefined;
  problems?: CodeEditorProblem[];
  handleRef?: React.RefObject<CodeEditorHandle | null>;
  isInvalid?: boolean;
  /** Tailwind min-height class, e.g. "min-h-60". */
  minHeightClassName?: string;
};
