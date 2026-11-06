#!/usr/bin/env bun
/**
 * Measures a release binary against the performance budgets and fails when one is exceeded
 * (DS-07): the binary's size, cold start to listening, idle memory and SMTP ingest. Run on the
 * CI's Linux x64 runner, the machine the budgets are set for.
 *
 *     bun scripts/performance-budget.ts <binary>
 *
 * The limits, and any override with its reason, are in scripts/performance/budgets.json.
 */
import { appendFileSync, readFileSync, statSync } from "node:fs";
import { connect, type Socket } from "node:net";

import { startSendmock, stopSendmock } from "./binary-smoke-test";
import {
  type Budget,
  evaluateBudgets,
  findBudgetFileProblems,
  formatBudgetTable,
} from "./performance/budget-rules";

const coldStartRuns = 10;
const idleWaitMs = 5_000;
const smtpConnectionCount = 10;
const smtpMessageCount = 2_000;
const memoryServeArguments = [
  "--http-addr",
  "127.0.0.1:0",
  "--smtp-addr",
  "127.0.0.1:0",
  "--db",
  "memory",
  "--max-emails",
  "100000",
];

function readMedian(values: number[]): number {
  const sortedValues = [...values].sort((first, second) => first - second);
  return sortedValues[Math.floor(sortedValues.length / 2)] ?? Number.NaN;
}

async function measureColdStartMs(binaryPath: string): Promise<number> {
  const startTimesMs: number[] = [];
  for (let run = 0; run < coldStartRuns; run += 1) {
    const startedAt = performance.now();
    const runningSendmock = await startSendmock(
      binaryPath,
      memoryServeArguments,
    );
    startTimesMs.push(performance.now() - startedAt);
    await stopSendmock(runningSendmock);
  }
  return readMedian(startTimesMs);
}

/** Resident memory in bytes, from `ps` (kilobytes), which Linux and macOS both have. */
function readResidentMemoryBytes(processId: number): number {
  const psResult = Bun.spawnSync(["ps", "-o", "rss=", "-p", String(processId)]);
  return Number(psResult.stdout.toString().trim()) * 1024;
}

/**
 * Sends a command (or nothing, for the greeting) and resolves with the reply's last line, the
 * one with a space after the code.
 */
function createSmtpExchanger(socket: Socket) {
  let bufferedText = "";
  let waitingResolver: ((replyLine: string) => void) | null = null;
  const resolveWhenReplyArrived = () => {
    const finalLine = /^\d{3} .*\r\n/m.exec(bufferedText);
    if (finalLine === null || waitingResolver === null) {
      return;
    }
    bufferedText = bufferedText.slice(finalLine.index + finalLine[0].length);
    const resolveReply = waitingResolver;
    waitingResolver = null;
    resolveReply(finalLine[0]);
  };
  socket.on("data", (chunk) => {
    bufferedText += chunk.toString();
    resolveWhenReplyArrived();
  });
  return (command: string | null) =>
    new Promise<string>((resolveReply) => {
      waitingResolver = resolveReply;
      if (command !== null) {
        socket.write(command);
      }
      resolveWhenReplyArrived();
    });
}

async function sendMessagesOverOneConnection(
  smtpAddress: string,
  connectionNumber: number,
  messageCount: number,
) {
  const portSeparatorIndex = smtpAddress.lastIndexOf(":");
  const socket = connect({
    host: smtpAddress.slice(0, portSeparatorIndex),
    port: Number(smtpAddress.slice(portSeparatorIndex + 1)),
  });
  const sendCommand = createSmtpExchanger(socket);
  await sendCommand(null);
  await sendCommand("EHLO budget.example.test\r\n");
  for (
    let messageNumber = 0;
    messageNumber < messageCount;
    messageNumber += 1
  ) {
    await sendCommand("MAIL FROM:<budget@example.test>\r\n");
    await sendCommand(`RCPT TO:<inbox-${connectionNumber}@example.test>\r\n`);
    await sendCommand("DATA\r\n");
    await sendCommand(
      `Subject: Budget ${connectionNumber}-${messageNumber}\r\n\r\nA small message.\r\n.\r\n`,
    );
  }
  await sendCommand("QUIT\r\n");
  socket.end();
}

async function waitForStoredEmailCount(
  httpAddress: string,
  expectedCount: number,
) {
  while (true) {
    const listResponse = await fetch(
      `http://${httpAddress}/api/v1/emails?limit=1`,
    );
    const emailPage = (await listResponse.json()) as { total_count?: number };
    if ((emailPage.total_count ?? 0) >= expectedCount) {
      return;
    }
    await Bun.sleep(20);
  }
}

/** Idle memory first, then SMTP ingest: messages a second until every one is stored. */
async function measureRunningBinary(binaryPath: string) {
  const runningSendmock = await startSendmock(binaryPath, memoryServeArguments);
  try {
    await Bun.sleep(idleWaitMs);
    const idleMemoryBytes = readResidentMemoryBytes(
      runningSendmock.sendmock.pid,
    );
    const messagesPerConnection = smtpMessageCount / smtpConnectionCount;
    const startedAt = performance.now();
    await Promise.all(
      Array.from({ length: smtpConnectionCount }, (_, connectionNumber) =>
        sendMessagesOverOneConnection(
          runningSendmock.smtpAddress,
          connectionNumber,
          messagesPerConnection,
        ),
      ),
    );
    await waitForStoredEmailCount(
      runningSendmock.httpAddress,
      smtpMessageCount,
    );
    const ingestSeconds = (performance.now() - startedAt) / 1000;
    return {
      idleMemoryBytes,
      smtpIngestMessagesPerSecond: smtpMessageCount / ingestSeconds,
    };
  } finally {
    await stopSendmock(runningSendmock);
  }
}

async function main() {
  const [binaryPath] = process.argv.slice(2);
  if (!binaryPath) {
    console.error("Usage: bun scripts/performance-budget.ts <binary>");
    process.exit(2);
  }
  const budgets = JSON.parse(
    readFileSync(
      new URL("./performance/budgets.json", import.meta.url),
      "utf8",
    ),
  ) as Record<string, Budget>;
  const budgetFileProblems = findBudgetFileProblems(budgets);
  if (budgetFileProblems.length > 0) {
    console.error(budgetFileProblems.join("\n"));
    process.exit(1);
  }
  const coldStartMs = await measureColdStartMs(binaryPath);
  const runningMeasurements = await measureRunningBinary(binaryPath);
  const results = evaluateBudgets(budgets, {
    binary_size_bytes: statSync(binaryPath).size,
    cold_start_ms: coldStartMs,
    idle_memory_bytes: runningMeasurements.idleMemoryBytes,
    smtp_ingest_messages_per_second:
      runningMeasurements.smtpIngestMessagesPerSecond,
  });
  const budgetTable = formatBudgetTable(results);
  console.log(budgetTable);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `## Performance budgets\n\n${budgetTable}\n`,
    );
  }
  const exceededResults = results.filter((result) => !result.isWithinBudget);
  for (const exceededResult of exceededResults) {
    const side =
      exceededResult.unit === "messages/s"
        ? "below its minimum"
        : "past its limit";
    console.log(
      `::error title=Performance budget::${exceededResult.label} is ${Math.round(exceededResult.measured)} ${exceededResult.unit}, ${side} of ${exceededResult.limit}; improve it, or add an override with a reason in scripts/performance/budgets.json`,
    );
  }
  process.exit(exceededResults.length > 0 ? 1 : 0);
}

await main();
