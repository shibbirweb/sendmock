/** One node of a Playwright aria snapshot: `- button "Save"` or `- paragraph: Some text`. */
export type AriaNode = {
  role: string;
  name: string;
  /** Inline text after the colon, such as a paragraph's words. */
  text: string;
  children: AriaNode[];
};

const nodePattern =
  /^([a-z]+)(?: "((?:[^"\\]|\\.)*)")?(?: \[[^\]]*\])*(?::\s*(.*))?$/;

/** YAML quotes a line holding `: `, as `'link "Re: Hello"'` or `"text: a: b"`. */
function unquoteYamlScalar(entryText: string): string {
  if (entryText.startsWith("'") && entryText.endsWith("'")) {
    return entryText.slice(1, -1).replaceAll("''", "'");
  }
  if (entryText.startsWith('"') && entryText.endsWith('"')) {
    return JSON.parse(entryText) as string;
  }
  return entryText;
}

function parseEntry(entryText: string): AriaNode | null {
  const unquotedEntry = unquoteYamlScalar(entryText.replace(/:$/, ""));
  const nodeMatch = unquotedEntry.match(nodePattern);
  if (nodeMatch === null) {
    return null;
  }
  const inlineText = nodeMatch[3] ?? "";
  return {
    role: nodeMatch[1] ?? "",
    name: (nodeMatch[2] ?? "").replaceAll('\\"', '"'),
    text: unquoteYamlScalar(inlineText.trim()),
    children: [],
  };
}

/** The snapshot as a tree; property lines such as `/url:` are skipped. */
export function parseAriaSnapshot(snapshotText: string): AriaNode[] {
  const rootNodes: AriaNode[] = [];
  const openNodes: { indent: number; node: AriaNode }[] = [];
  for (const line of snapshotText.split("\n")) {
    const lineMatch = line.match(/^(\s*)- (.*)$/);
    if (lineMatch === null || (lineMatch[2] ?? "").startsWith("/")) {
      continue;
    }
    const indent = (lineMatch[1] ?? "").length;
    const node = parseEntry(lineMatch[2] ?? "");
    if (node === null) {
      continue;
    }
    while ((openNodes.at(-1)?.indent ?? -1) >= indent) {
      openNodes.pop();
    }
    const parentNode = openNodes.at(-1)?.node;
    (parentNode?.children ?? rootNodes).push(node);
    openNodes.push({ indent, node });
  }
  return rootNodes;
}
