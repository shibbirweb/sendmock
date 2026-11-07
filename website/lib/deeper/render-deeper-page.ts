import { posix } from "node:path";

import type { ScreenState } from "./deeper-inventory";
import type { OperationSurfaces } from "./deeper-surfaces";
import type { DeeperEntry, DeeperPage } from "./deeper-types";
import { numberDeeperEntries } from "./number-deeper-entries";

const stateHeadings: Record<string, string> = {
  normal: "On the screen",
  empty: "With no data yet",
  failing: "When the data cannot load",
};

const roleWords: Record<string, string> = {
  button: "Button",
  link: "Link",
  tab: "Tab",
  menuitem: "Menu item",
  menuitemcheckbox: "Menu item",
  menuitemradio: "Menu item",
  switch: "Switch",
  checkbox: "Checkbox",
  radio: "Choice",
  combobox: "Drop-down",
  textbox: "Field",
  searchbox: "Search field",
  spinbutton: "Number field",
  slider: "Slider",
  option: "Option",
  columnheader: "Column",
  img: "Badge",
  heading: "Heading",
  alert: "Message",
  status: "Status",
  dialog: "Dialog",
  alertdialog: "Dialog",
  paragraph: "Text",
};

/** `each item, checkbox: Select email from …` as its parts. */
export function splitControl(control: string): {
  role: string;
  name: string;
  isPerItem: boolean;
} {
  const isPerItem = control.startsWith("each item, ");
  const roleAndName = isPerItem ? control.slice("each item, ".length) : control;
  const separatorIndex = roleAndName.indexOf(": ");
  return {
    role: roleAndName.slice(0, separatorIndex),
    name: roleAndName.slice(separatorIndex + 2),
    isPerItem,
  };
}

/** The docs site reads pages as MDX, where `{`, `}` and `<` start code; GitHub shows the escapes as plain characters. */
export function escapeMdxText(text: string): string {
  return text.replace(/[\\{}<]/g, (character) => `\\${character}`);
}

function renderSurfaces(
  operationIds: string[],
  surfacesById: Map<string, OperationSurfaces>,
): string[] {
  return operationIds.map((operationId) => {
    const surfaces = surfacesById.get(operationId);
    const parts = [
      `REST ${surfaces?.rest ?? operationId}`,
      ...(surfaces?.cli ? [`CLI ${surfaces.cli}`] : []),
      ...(surfaces?.mcp ? [`MCP ${surfaces.mcp}`] : []),
    ];
    return `- **Same action elsewhere:** ${parts.join(", ")}`;
  });
}

function renderEntry(
  entryNumber: number,
  control: string,
  entry: DeeperEntry,
  surfacesById: Map<string, OperationSurfaces>,
): string {
  const { role, name, isPerItem } = splitControl(control);
  const kindText = `${roleWords[role] ?? role}${isPerItem ? ", in each row" : ""}`;
  const detailLines = [
    `- **What it does:** ${entry.does}`,
    ...(entry.changes ? [`- **What it changes:** ${entry.changes}`] : []),
    ...(entry.source
      ? [`- **Where its text comes from:** ${entry.source}`]
      : []),
    ...(entry.links ? [`- **Links to:** ${entry.links}`] : []),
    ...(entry.errors ? [`- **Errors:** ${entry.errors}`] : []),
    ...renderSurfaces(entry.operationIds ?? [], surfacesById),
  ];
  return [
    `### ${entryNumber}. ${escapeMdxText(name)}`,
    "",
    `${kindText}.`,
    "",
    ...detailLines,
    "",
  ].join("\n");
}

/** Where a page's annotated screenshot lives, relative to `docs/wiki/deeper/`. */
export function toDeeperImageFile(pageFile: string): string {
  return `images/${pageFile.replace(/\.md$/, "").replaceAll("/", "-")}.jpg`;
}

/** The Markdown of a Deeper page, its entries numbered in screen order. */
export function renderDeeperPage(
  deeperPage: DeeperPage,
  screenStates: ScreenState[],
  surfacesById: Map<string, OperationSurfaces>,
): string {
  const guideLink = posix.relative(
    posix.dirname(posix.join("deeper", deeperPage.file)),
    deeperPage.guidePage,
  );
  const relativeImagePath = posix.relative(
    posix.dirname(deeperPage.file),
    toDeeperImageFile(deeperPage.file),
  );
  // MDX reads a path without `./` or `../` as a package to import.
  const imageLink = relativeImagePath.startsWith("../")
    ? relativeImagePath
    : `./${relativeImagePath}`;
  const sections = numberDeeperEntries(deeperPage, screenStates).map(
    (numberedState) =>
      [
        `## ${stateHeadings[numberedState.state] ?? numberedState.state}`,
        "",
        ...numberedState.numberedEntries.map(
          ({ entryNumber, control, entry }) =>
            renderEntry(entryNumber, control, entry, surfacesById),
        ),
      ].join("\n"),
  );
  return [
    "---",
    `title: ${deeperPage.title}`,
    `description: ${deeperPage.description}`,
    "---",
    "",
    "> Every control and text this screen shows, in screen order. The list is read from the demo by a crawl, and CI fails when the screen changes without its entry here.",
    "",
    deeperPage.intro,
    "",
    `The screen as a whole: [${deeperPage.guideTitle}](${guideLink}).`,
    "",
    `![${deeperPage.title.replace(/ in depth$/, "")}, with a number on each control](${imageLink})`,
    "",
    "The numbers match the entries below. The picture shows the first screenful; controls further down, and texts, have no marker.",
    "",
    ...sections,
  ]
    .join("\n")
    .trimEnd()
    .concat("\n");
}
