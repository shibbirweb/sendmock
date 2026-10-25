import * as React from "react";

import { Skeleton } from "@/components/ui/skeleton";
import type { CodeEditorProps } from "@/features/webhooks/templates/reference/code-editor/code-editor-types";

const LazyCodeEditorView = React.lazy(
  () =>
    import("@/features/webhooks/templates/reference/code-editor/code-editor-view"),
);

/** The code editor, loaded in its own chunk the first time one opens. */
export function CodeEditor(codeEditorProps: CodeEditorProps) {
  return (
    <React.Suspense
      fallback={
        <Skeleton
          className={codeEditorProps.minHeightClassName ?? "min-h-60"}
        />
      }
    >
      <LazyCodeEditorView {...codeEditorProps} />
    </React.Suspense>
  );
}
