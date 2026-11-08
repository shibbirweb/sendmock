export type InlinePart =
  | { kind: "text"; text: string }
  | { kind: "bold"; text: string }
  | { kind: "code"; text: string }
  | { kind: "link"; text: string; url: string };

const inlinePattern =
  /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\)|https?:\/\/[^\s)]+[^\s).,;:])/g;

function readInlinePart(token: string): InlinePart {
  if (token.startsWith("`")) {
    return { kind: "code", text: token.slice(1, -1) };
  }
  if (token.startsWith("**")) {
    return { kind: "bold", text: token.slice(2, -2) };
  }
  const markdownLink = token.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
  if (markdownLink) {
    return {
      kind: "link",
      text: markdownLink[1] ?? "",
      url: markdownLink[2] ?? "",
    };
  }
  return { kind: "link", text: token, url: token };
}

/** Splits a changelog line into the plain, bold, code and link parts its Markdown marks. */
export function splitInlineMarkdown(line: string): InlinePart[] {
  const parts: InlinePart[] = [];
  let textStart = 0;
  for (const tokenMatch of line.matchAll(inlinePattern)) {
    const tokenStart = tokenMatch.index ?? 0;
    if (tokenStart > textStart) {
      parts.push({ kind: "text", text: line.slice(textStart, tokenStart) });
    }
    parts.push(readInlinePart(tokenMatch[0]));
    textStart = tokenStart + tokenMatch[0].length;
  }
  if (textStart < line.length) {
    parts.push({ kind: "text", text: line.slice(textStart) });
  }
  return parts;
}
