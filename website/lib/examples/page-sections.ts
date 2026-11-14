/**
 * Turns the code examples and test helpers into guide sections and puts them
 * into the docs/wiki pages (docs/plan/21-reference-and-examples.md, WS-08).
 */
import type { ExampleContract } from "./example-contract";
import type { CodeExample } from "./example-types";
import { cliRenderer } from "./render-cli";
import { csharpRenderer } from "./render-csharp";
import { goRenderer } from "./render-go";
import { javaRenderer } from "./render-java";
import { javaScriptRenderer } from "./render-javascript";
import { phpRenderer } from "./render-php";
import { pythonRenderer } from "./render-python";
import { rubyRenderer } from "./render-ruby";
import { rustRenderer } from "./render-rust";
import type { ExampleRenderer } from "./render-shared";
import { type TestHelper, testHelpers } from "./test-helpers";

/** The tabs, in order; the first one carries the tab group, so the choice is remembered. */
export const exampleRenderers: ExampleRenderer[] = [
  cliRenderer,
  phpRenderer,
  javaScriptRenderer,
  pythonRenderer,
  goRenderer,
  javaRenderer,
  rustRenderer,
  rubyRenderer,
  csharpRenderer,
];

export type PageSection = {
  page: string;
  heading: string;
  /** The heading the section goes before when the page does not have it yet; null for the end. */
  insertBefore: string | null;
  body: string;
};

/** `recipes/read-a-code.md` reaches `connect/index.md` as `../connect/index.md`. */
function linkFromPage(page: string, target: string): string {
  const depth = page.split("/").length - 1;

  return `${depth === 0 ? "./" : "../".repeat(depth)}${target}`;
}

function renderExampleBody(
  codeExample: CodeExample,
  exampleContract: ExampleContract,
): string {
  const helperNote = `The examples call SendMock's REST API with each language's usual HTTP client and test framework. JavaScript, Go, Java, Rust, Ruby and C# use the small \`call\` helper shown under **Test helper** on their page in [Connect your app](${linkFromPage(codeExample.page, "connect/index.md")}).`;
  const codeBlocks = exampleRenderers.map((exampleRenderer, rendererIndex) => {
    const tabGroup = rendererIndex === 0 ? ' tab-group="language"' : "";
    return `\`\`\`${exampleRenderer.fenceLanguage} tab="${exampleRenderer.tabName}"${tabGroup}\n${exampleRenderer.render(codeExample, exampleContract)}\n\`\`\``;
  });

  return [codeExample.intro, helperNote, ...codeBlocks].join("\n\n");
}

function renderHelperBody(testHelper: TestHelper): string {
  return [
    `Save this as \`${testHelper.fileName}\`. The code examples in the [recipes](../recipes/index.md) use it to call SendMock and your app.`,
    `\`\`\`${testHelper.fenceLanguage} title="${testHelper.fileName}"\n${testHelper.code}\n\`\`\``,
  ].join("\n\n");
}

export function buildPageSections(
  codeExamples: CodeExample[],
  exampleContract: ExampleContract,
): PageSection[] {
  return [
    ...codeExamples.map((codeExample) => ({
      page: codeExample.page,
      heading: codeExample.heading,
      insertBefore:
        codeExample.heading === "In your code"
          ? "What you should see"
          : "From the CLI, API and AI",
      body: renderExampleBody(codeExample, exampleContract),
    })),
    ...testHelpers.map((testHelper) => ({
      page: testHelper.page,
      heading: "Test helper",
      insertBefore: null,
      body: renderHelperBody(testHelper),
    })),
  ];
}

/** The page with the section written in: replaced when it is there, added otherwise. */
export function applyPageSection(
  pageText: string,
  pageSection: PageSection,
): string {
  const sectionText = `## ${pageSection.heading}\n\n${pageSection.body}\n`;
  const headingLine = `\n## ${pageSection.heading}\n`;
  const sectionStart = pageText.indexOf(headingLine);
  if (sectionStart !== -1) {
    const nextHeading = pageText.indexOf(
      "\n## ",
      sectionStart + headingLine.length,
    );
    const sectionEnd = nextHeading === -1 ? pageText.length : nextHeading + 1;
    return `${pageText.slice(0, sectionStart + 1)}${sectionText}${nextHeading === -1 ? "" : "\n"}${pageText.slice(sectionEnd)}`;
  }
  const anchorStart =
    pageSection.insertBefore === null
      ? -1
      : pageText.indexOf(`\n## ${pageSection.insertBefore}\n`);
  if (anchorStart === -1) {
    return `${pageText.trimEnd()}\n\n${sectionText}`;
  }

  return `${pageText.slice(0, anchorStart + 1)}${sectionText}\n${pageText.slice(anchorStart + 1)}`;
}
