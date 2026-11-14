const setStatementPattern =
  /\{%-?\s*set\s+([a-z_][a-z0-9_]*)\s*=\s*([\s\S]+?)\s*-?%\}\n?/gi;

/**
 * Removes top-level `{% set name = expression %}` statements and gives back each name with its
 * expression in order, so the renderer can evaluate them before the rest: the subset the
 * built-in templates use to share a timestamp between a body and its signature.
 */
export function extractTemplateSets(templateText: string): {
  remainingText: string;
  assignments: { variableName: string; expressionText: string }[];
} {
  const assignments: { variableName: string; expressionText: string }[] = [];
  const remainingText = templateText.replace(
    setStatementPattern,
    (_, variableName: string, expressionText: string) => {
      assignments.push({ variableName, expressionText });
      return "";
    },
  );

  return { remainingText, assignments };
}
