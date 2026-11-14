/** Reads a context path for a loop; `undefined` when it is missing. */
type LoopValueReader = (pathText: string) => unknown;

const forBlockPattern =
  /\{%-?\s*for\s+([a-z_][a-z0-9_]*)\s+in\s+([\w.[\]]+)\s*-?%\}([\s\S]*?)\{%-?\s*endfor\s*-?%\}/i;

function escapeForPattern(literalText: string): string {
  return literalText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** One pass of the body with the loop variable pointing at item `itemIndex`. */
function expandLoopBody(
  loopBody: string,
  itemName: string,
  listPath: string,
  itemIndex: number,
): string {
  return loopBody
    .replace(/\{\{\s*loop\.index0\s*\}\}/g, String(itemIndex))
    .replace(/\{\{\s*loop\.index\s*\}\}/g, String(itemIndex + 1))
    .replace(
      new RegExp(`\\b${escapeForPattern(itemName)}\\b(?=\\s*[.|}[])`, "g"),
      `${listPath}[${itemIndex}]`,
    );
}

/**
 * Expands `{% for item in list %}` blocks (not nested) once per item, with
 * `{{ loop.index0 }}` and `{{ loop.index }}`; a missing or empty list renders
 * nothing. The subset the built-in templates use.
 */
export function resolveTemplateLoops(
  templateText: string,
  readLoopValue: LoopValueReader,
): string {
  let resolvedText = templateText;
  let forMatch = forBlockPattern.exec(resolvedText);
  while (forMatch !== null) {
    const [wholeBlock, itemName = "", listPath = "", loopBody = ""] = forMatch;
    const listValue = readLoopValue(listPath);
    const itemCount = Array.isArray(listValue) ? listValue.length : 0;
    const expandedText = Array.from({ length: itemCount }, (_, itemIndex) =>
      expandLoopBody(loopBody, itemName, listPath, itemIndex),
    ).join("");
    resolvedText =
      resolvedText.slice(0, forMatch.index) +
      expandedText +
      resolvedText.slice(forMatch.index + wholeBlock.length);
    forMatch = forBlockPattern.exec(resolvedText);
  }

  return resolvedText;
}
