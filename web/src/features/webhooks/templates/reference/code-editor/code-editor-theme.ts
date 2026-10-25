import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import {
  Decoration,
  EditorView,
  MatchDecorator,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";
import { tags } from "@lezer/highlight";

/** Editor chrome from the design tokens, so it follows light and dark mode. */
export const codeEditorTheme = EditorView.theme({
  "&": {
    fontSize: "12px",
    backgroundColor: "transparent",
    color: "var(--foreground)",
    height: "100%",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: "var(--font-mono, ui-monospace, monospace)" },
  ".cm-content": { caretColor: "var(--foreground)", padding: "8px 0" },
  ".cm-gutters": {
    backgroundColor: "var(--muted)",
    color: "var(--muted-foreground)",
    border: "none",
    borderRight: "1px solid var(--border)",
  },
  ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "transparent" },
  "&.cm-focused .cm-activeLine": { backgroundColor: "var(--muted)" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
    backgroundColor: "var(--accent)",
  },
  ".cm-tooltip": {
    backgroundColor: "var(--popover)",
    color: "var(--popover-foreground)",
    border: "1px solid var(--border)",
    borderRadius: "calc(var(--radius) * 0.8)",
  },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
    backgroundColor: "var(--accent)",
    color: "var(--accent-foreground)",
  },
  ".cm-completionDetail": {
    color: "var(--muted-foreground)",
    marginLeft: "8px",
  },
  ".cm-template-expression": {
    color: "var(--code-expression)",
    backgroundColor: "var(--code-expression-background)",
    borderRadius: "3px",
  },
  ".cm-problem-error": {
    textDecoration: "underline wavy var(--destructive)",
    textUnderlineOffset: "3px",
  },
  ".cm-problem-warning": {
    textDecoration: "underline wavy var(--warning)",
    textUnderlineOffset: "3px",
  },
  ".cm-value-hover": {
    padding: "6px 8px",
    maxWidth: "20rem",
    display: "grid",
    gap: "2px",
  },
  ".cm-value-hover-detail": {
    color: "var(--muted-foreground)",
    fontSize: "11px",
  },
});

export const codeHighlighting = syntaxHighlighting(
  HighlightStyle.define([
    { tag: tags.propertyName, color: "var(--code-key)" },
    { tag: tags.string, color: "var(--code-string)" },
    { tag: tags.number, color: "var(--code-number)" },
    { tag: [tags.bool, tags.null], color: "var(--code-literal)" },
    { tag: tags.punctuation, color: "var(--muted-foreground)" },
  ]),
);

const expressionDecorator = new MatchDecorator({
  regexp: /\{\{[^}]*\}\}/g,
  decoration: Decoration.mark({ class: "cm-template-expression" }),
});

/** Marks every `{{ ... }}` so template parts stand out from the text around them. */
export const templateExpressionHighlighter = ViewPlugin.define(
  (editorView) => ({
    decorations: expressionDecorator.createDeco(editorView),
    update(viewUpdate: ViewUpdate) {
      this.decorations = expressionDecorator.updateDeco(
        viewUpdate,
        this.decorations,
      );
    },
  }),
  { decorations: (pluginValue) => pluginValue.decorations },
);
