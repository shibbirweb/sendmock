// Runs the API playground's snippets in one language against the SendMock on 127.0.0.1:8025
// (WS-04.2): stores an email for the snippets that need an id, runs every snippet as the
// playground shows it, then checks each answered 2xx and that their effects are stored.
//
//     node examples/playground-snippets/run-playground-snippets.mjs <language>
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { snippetPrograms } from "./snippet-programs.mjs";

const sendmockApiUrl = "http://127.0.0.1:8025/api/v1";

async function callSendMock(method, path, body) {
  const response = await fetch(`${sendmockApiUrl}${path}`, {
    method,
    headers: body === undefined ? {} : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const responseText = await response.text();
  return {
    status: response.status,
    body: responseText === "" ? null : JSON.parse(responseText),
  };
}

/** An email the update and delete snippets act on, so they have a real id. */
async function storeEmailForSnippets() {
  const recipient = `playground-snippets-${Date.now()}@example.test`;
  const sendAnswer = await callSendMock("POST", "/send", {
    from: "playground@example.test",
    to: [recipient],
    subject: "Stored for the playground snippets",
    text: "The update and delete snippets act on this email.",
  });
  if (sendAnswer.status >= 300) {
    throw new Error(`Storing the email answered ${sendAnswer.status}.`);
  }
  const listAnswer = await callSendMock(
    "GET",
    `/emails?to=${encodeURIComponent(recipient)}`,
  );
  const emailId = listAnswer.body?.items?.[0]?.id;
  if (emailId === undefined) {
    throw new Error(
      `The stored email was not listed: ${JSON.stringify(listAnswer.body)}`,
    );
  }
  return emailId;
}

function writeProgram(programFiles) {
  const programFolder = mkdtempSync(join(tmpdir(), "playground-snippets-"));
  for (const [relativePath, fileText] of Object.entries(programFiles)) {
    mkdirSync(dirname(join(programFolder, relativePath)), { recursive: true });
    writeFileSync(join(programFolder, relativePath), fileText);
  }
  return programFolder;
}

function readStatuses(programOutput) {
  return new Map(
    [...programOutput.matchAll(/^STATUS (\S+) (\d{3})$/gm)].map(
      (statusMatch) => [statusMatch[1], Number(statusMatch[2])],
    ),
  );
}

async function checkEffects(emailId) {
  const problems = [];
  const sentEmails = await callSendMock("GET", "/emails?query=1042");
  const isSentEmailStored = (sentEmails.body?.items ?? []).some(
    (emailSummary) => emailSummary.subject === "Your order #1042 has shipped",
  );
  if (!isSentEmailStored) {
    problems.push("the send-email snippet's email is not stored");
  }
  const sentSms = await callSendMock("GET", "/sms?query=482913");
  if ((sentSms.body?.items ?? []).length === 0) {
    problems.push("the send-sms snippet's SMS is not stored");
  }
  const deletedEmail = await callSendMock("GET", `/emails/${emailId}`);
  if (deletedEmail.status !== 404) {
    problems.push(`the deleted email still answers ${deletedEmail.status}`);
  }
  return problems;
}

async function runPlaygroundSnippets(language) {
  const snippetProgram = snippetPrograms[language];
  if (snippetProgram === undefined) {
    throw new Error(`No snippet program for "${language}".`);
  }
  const snippetSet = JSON.parse(
    readFileSync(new URL("playground-snippets.json", import.meta.url), "utf8"),
  );
  const emailId = await storeEmailForSnippets();
  const snippetBlocks = snippetSet.playgroundSnippets.map(
    (playgroundSnippet) => ({
      label: playgroundSnippet.label,
      code: playgroundSnippet.snippets[
        snippetProgram.snippetLanguage
      ].replaceAll(snippetSet.emailIdPlaceholder, emailId),
    }),
  );
  const { files, command } = snippetProgram.buildProgram(snippetBlocks);
  const programFolder = writeProgram(files);
  const [commandName, commandArguments] = command;
  const programRun = spawnSync(commandName, commandArguments, {
    cwd: programFolder,
    encoding: "utf8",
    env: process.env,
  });
  const programOutput = `${programRun.stdout ?? ""}${programRun.stderr ?? ""}`;
  console.log(programOutput);

  const problems = [];
  if (programRun.status !== 0) {
    problems.push(
      `${commandName} exited with ${programRun.status} (${programRun.error?.message ?? "see the output above"})`,
    );
  }
  const statuses = readStatuses(programRun.stdout ?? "");
  for (const { label } of snippetBlocks) {
    const status = statuses.get(label);
    if (status === undefined || status < 200 || status >= 300) {
      problems.push(`${label} answered ${status ?? "nothing"}`);
    }
  }
  problems.push(...(await checkEffects(emailId)));
  return problems;
}

const language = process.argv[2] ?? "";
const problems = await runPlaygroundSnippets(language);
if (problems.length > 0) {
  for (const problem of problems) {
    console.log(`::error title=Playground snippets (${language})::${problem}`);
  }
  process.exit(1);
}
console.log(`Every playground snippet ran in ${language} and answered 2xx.`);
