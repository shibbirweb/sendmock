// Runs every recipe's "In your code" example for one language against a running SendMock and
// the stand-in app. The code is read from the guide pages, so it is what a reader copies.
//
// Usage: node run-recipes.mjs <language>   (run from the language's folder, e.g. node/)
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

import { recipeLanguages } from "./recipe-languages.mjs";

const wikiFolder = new URL("../../docs/wiki/", import.meta.url).pathname;
const sendmockApiUrl = process.env.SENDMOCK_URL ?? "http://127.0.0.1:8025";
// "Share your setup" resets SendMock to the seed, so it runs after the recipes that need traffic.
const lastRecipeSlug = "share-your-setup";
const failedDeliveryWaitMs = 30_000;

/** The fenced blocks of a section: `## <heading>` up to the next `## `. */
function readSectionBlocks(pageText, heading) {
  const sectionStart = pageText.indexOf(`\n## ${heading}\n`);
  if (sectionStart === -1) {
    return [];
  }
  const sectionEnd = pageText.indexOf(
    "\n## ",
    sectionStart + heading.length + 4,
  );
  const sectionText = pageText.slice(
    sectionStart,
    sectionEnd === -1 ? undefined : sectionEnd,
  );
  const blockPattern = /^```([^\n]*)\n([\s\S]*?)^```$/gm;

  return [...sectionText.matchAll(blockPattern)].map((blockMatch) => ({
    infoString: blockMatch[1],
    code: blockMatch[2],
  }));
}

function readRecipeCode(recipeSlug, tabName) {
  const pageText = readFileSync(
    join(wikiFolder, "recipes", `${recipeSlug}.md`),
    "utf8",
  );
  const tabBlock = readSectionBlocks(pageText, "In your code").find((block) =>
    block.infoString.includes(`tab="${tabName}"`),
  );

  return tabBlock?.code ?? null;
}

/** The language's `call` helper and the name its Connect page saves it under, if it has one. */
function readTestHelper(recipeLanguage) {
  if (recipeLanguage.helperPage === null) {
    return null;
  }
  const pageText = readFileSync(
    join(wikiFolder, recipeLanguage.helperPage),
    "utf8",
  );
  const helperBlock = readSectionBlocks(pageText, "Test helper")[0];
  const helperFileName = helperBlock?.infoString.match(/title="([^"]+)"/)?.[1];
  if (helperFileName === undefined) {
    throw new Error(
      `${recipeLanguage.helperPage} has no Test helper block with a title`,
    );
  }

  return { helperFileName, code: helperBlock.code };
}

/** Writes a file inside a recipe's folder, making the folders on its path. */
function writeRecipeFile(recipeFolder, relativePath, fileText) {
  const filePath = join(recipeFolder, relativePath);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, fileText);

  return filePath;
}

/** Each recipe runs in its own folder with its own copy of the helper. */
function writeRecipeFolder(recipeLanguage, recipeSlug, recipeCode, testHelper) {
  const recipeFolder = join(process.cwd(), "generated", recipeSlug);
  if (testHelper !== null) {
    writeRecipeFile(
      recipeFolder,
      recipeLanguage.helperFilePath(testHelper.helperFileName),
      testHelper.code,
    );
  }
  for (const [relativePath, fileText] of Object.entries(
    recipeLanguage.extraFiles ?? {},
  )) {
    writeRecipeFile(recipeFolder, relativePath, fileText);
  }
  const recipeFilePath = writeRecipeFile(
    recipeFolder,
    recipeLanguage.recipeFilePath(recipeSlug),
    recipeLanguage.prepareCode?.(recipeCode) ?? recipeCode,
  );

  return { recipeFolder, recipeFilePath };
}

function readRecipeSlugs() {
  const recipeSlugs = readdirSync(join(wikiFolder, "recipes"))
    .filter((fileName) => fileName.endsWith(".md"))
    .map((fileName) => fileName.replace(/\.md$/, ""))
    .filter((recipeSlug) => readRecipeCode(recipeSlug, "CLI") !== null)
    .sort();

  return [
    ...recipeSlugs.filter((recipeSlug) => recipeSlug !== lastRecipeSlug),
    lastRecipeSlug,
  ];
}

async function callSendMock(method, path, jsonBody) {
  const response = await fetch(`${sendmockApiUrl}/api/v1${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: jsonBody === undefined ? undefined : JSON.stringify(jsonBody),
  });
  if (!response.ok) {
    throw new Error(
      `${method} ${path} answered ${response.status}: ${await response.text()}`,
    );
  }

  return response.status === 204 ? null : response.json();
}

/** "Replay a failed webhook" starts from a delivery the app's handler failed. */
async function makeFailedDelivery() {
  await callSendMock("POST", "/send", {
    from: "Sam <sam@customer.test>",
    to: ["orders@shop.test"],
    subject: "Order 42",
    text: "Where is my order?",
  });
  const deadline = Date.now() + failedDeliveryWaitMs;
  while (Date.now() < deadline) {
    const failedDeliveries = await callSendMock(
      "GET",
      "/webhooks/deliveries?status=failed&limit=1",
    );
    if ((failedDeliveries?.items ?? []).length > 0) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("No failed delivery to the order handler that is down");
}

async function runRecipes(recipeLanguage) {
  rmSync(join(process.cwd(), "generated"), { recursive: true, force: true });
  const testHelper = readTestHelper(recipeLanguage);
  await makeFailedDelivery();
  const failedRecipeSlugs = [];
  for (const recipeSlug of readRecipeSlugs()) {
    const recipeCode = readRecipeCode(recipeSlug, recipeLanguage.tabName);
    if (recipeCode === null) {
      failedRecipeSlugs.push(
        `${recipeSlug} (no ${recipeLanguage.tabName} tab)`,
      );
      continue;
    }
    const { recipeFolder, recipeFilePath } = writeRecipeFolder(
      recipeLanguage,
      recipeSlug,
      recipeCode,
      testHelper,
    );
    console.log(`\n=== ${recipeSlug}`);
    const [command, commandArguments, commandFolder] =
      recipeLanguage.buildCommand(recipeFolder, recipeFilePath);
    const testRun = spawnSync(command, commandArguments, {
      cwd: commandFolder ?? recipeFolder,
      stdio: "inherit",
    });
    if (testRun.status !== 0) {
      failedRecipeSlugs.push(recipeSlug);
      console.log(
        `::error title=Recipe examples (${recipeLanguage.tabName})::${recipeSlug} failed`,
      );
    }
  }
  if (failedRecipeSlugs.length > 0) {
    throw new Error(`Failed recipes: ${failedRecipeSlugs.join(", ")}`);
  }
  console.log(
    `\nEvery recipe's ${recipeLanguage.tabName} example passed against SendMock.`,
  );
}

const languageKey = process.argv[2] ?? "";
const recipeLanguage = recipeLanguages[languageKey];
if (recipeLanguage === undefined) {
  console.error(`Pick a language: ${Object.keys(recipeLanguages).join(", ")}`);
  process.exit(2);
}
try {
  await runRecipes(recipeLanguage);
} catch (runError) {
  console.error(runError.message);
  process.exit(1);
}
