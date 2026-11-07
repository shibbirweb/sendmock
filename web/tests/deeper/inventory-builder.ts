import type { AriaNode } from "./aria-snapshot-parser";

/** A control or text a screen state shows, as the Deeper page documents it. */
export type InventoryControl = {
  role: string;
  name: string;
  /** In each item of a list or each row of a table, not once on the screen. */
  isPerItem: boolean;
};

const controlRoles = new Set([
  "button",
  "link",
  "tab",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "switch",
  "checkbox",
  "radio",
  "combobox",
  "textbox",
  "searchbox",
  "spinbutton",
  "slider",
  "option",
  "columnheader",
  "img",
]);
/** Texts recorded by their words, since they rarely have a name of their own. */
const textRoles = new Set(["heading", "alert", "status"]);
const itemRoles = new Set(["listitem", "row"]);
const dataNamePlaceholder = "…";

export type InventoryOptions = {
  /** Paragraphs too: empty states and errors say what to do in them. */
  isRecordingParagraphs: boolean;
};

export function normalizeName(name: string): string {
  return name.replace(/\s+/g, " ").replace(/\d+/g, "#").trim();
}

function readNodeText(node: AriaNode): string {
  return [node.name || node.text, ...node.children.map(readNodeText)]
    .filter((textPart) => textPart !== "")
    .join(" ");
}

function recordNode(
  node: AriaNode,
  options: InventoryOptions,
): InventoryControl | null {
  if (controlRoles.has(node.role) && node.name !== "") {
    return {
      role: node.role,
      name: normalizeName(node.name),
      isPerItem: false,
    };
  }
  const isRecordedText =
    textRoles.has(node.role) ||
    (options.isRecordingParagraphs && node.role === "paragraph");
  const nodeText = normalizeName(
    node.role === "heading"
      ? node.name || readNodeText(node)
      : readNodeText(node),
  );
  return isRecordedText && nodeText !== ""
    ? { role: node.role, name: nodeText, isPerItem: false }
    : null;
}

/** Navigation such as the sidebar: each item one short control with no record data. */
function isNavigationList(itemControlLists: InventoryControl[][]): boolean {
  return itemControlLists.every(
    (itemControls) =>
      itemControls.length <= 1 &&
      itemControls.every(
        (itemControl) =>
          !itemControl.name.includes("#") &&
          itemControl.name.split(" ").length <= 4,
      ),
  );
}

function collectControls(
  nodes: AriaNode[],
  options: InventoryOptions,
): InventoryControl[] {
  return nodes.flatMap((node) => {
    const itemChildren = node.children.filter((child) =>
      itemRoles.has(child.role),
    );
    const recordedNode = recordNode(node, options);
    const ownControls = recordedNode === null ? [] : [recordedNode];
    if (itemChildren.length >= 2) {
      const itemControlLists = itemChildren.map((item) =>
        collectControls(item.children, options),
      );
      if (!isNavigationList(itemControlLists)) {
        const otherChildren = node.children.filter(
          (child) => !itemRoles.has(child.role),
        );
        return [
          ...ownControls,
          ...collectControls(otherChildren, options),
          ...mergeItems(itemControlLists),
        ];
      }
    }
    return [...ownControls, ...collectControls(node.children, options)];
  });
}

function findCommonWords(wordLists: string[][]): string[] {
  const firstWords = wordLists[0] ?? [];
  const commonLength = firstWords.findIndex((word, wordIndex) =>
    wordLists.some((words) => words[wordIndex] !== word),
  );
  return firstWords.slice(
    0,
    commonLength === -1 ? firstWords.length : commonLength,
  );
}

/** "Select email from …" or "… success rate": the words every name shares, around the record's own. */
function generalizeNames(names: string[]): string {
  const wordLists = names.map((name) => name.split(" "));
  const prefixWords = findCommonWords(wordLists);
  const suffixWords = findCommonWords(
    wordLists.map((words) => words.slice(prefixWords.length).reverse()),
  ).reverse();
  return [...prefixWords, dataNamePlaceholder, ...suffixWords].join(" ");
}

/** One template for the items: shared words stay, the record's own become `…`. */
function mergeItems(
  itemControlLists: InventoryControl[][],
): InventoryControl[] {
  const namesByRole = new Map<string, string[]>();
  for (const itemControls of itemControlLists) {
    for (const itemControl of itemControls) {
      namesByRole.set(itemControl.role, [
        ...(namesByRole.get(itemControl.role) ?? []),
        itemControl.name,
      ]);
    }
  }
  return [...namesByRole].flatMap(([role, names]) => {
    const distinctNames = [...new Set(names)];
    const isSharedByEveryItem =
      names.length === itemControlLists.length && distinctNames.length === 1;
    if (isSharedByEveryItem) {
      return [{ role, name: distinctNames[0] ?? "", isPerItem: true }];
    }
    // Icons such as Unread or Has attachments are labels a row may or may not show.
    if (role === "img") {
      const labels = distinctNames.filter(
        (name) => names.filter((otherName) => otherName === name).length >= 2,
      );
      const hasRecordNames = labels.length < distinctNames.length;
      return [...labels, ...(hasRecordNames ? [dataNamePlaceholder] : [])].map(
        (name) => ({
          role,
          name,
          isPerItem: true,
        }),
      );
    }
    const generalizedName =
      distinctNames.length === 1
        ? (distinctNames[0] ?? "")
        : generalizeNames(distinctNames);
    return [{ role, name: generalizedName, isPerItem: true }];
  });
}

/** The controls of a snapshot in screen order, each once. */
export function buildInventory(
  nodes: AriaNode[],
  options: InventoryOptions,
): InventoryControl[] {
  const seenKeys = new Set<string>();
  return collectControls(nodes, options).filter((control) => {
    const controlKey = `${control.role}|${control.name}|${control.isPerItem}`;
    if (seenKeys.has(controlKey)) {
      return false;
    }
    seenKeys.add(controlKey);
    return true;
  });
}
