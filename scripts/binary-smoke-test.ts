#!/usr/bin/env bun
/**
 * Starts a built `sendmock` binary and checks that it serves the API and the embedded UI,
 * then stops it (the Phase 0 done-when check, docs/plan/23-phase-0.md).
 *
 *     bun scripts/binary-smoke-test.ts target/release/sendmock
 */

import type { Subprocess } from "bun";

const startupTimeoutMs = 30_000;
const readyMessage = "SendMock is ready";

type ReadyLine = { fields?: { http_addr?: string; smtp_addr?: string } };

type ListenerAddresses = { httpAddress: string; smtpAddress: string };

/** Reads stdout until the ready line, then keeps draining it so later log lines can be written. */
async function readAddressesFromReadyLine(
  stdout: ReadableStream<Uint8Array>,
): Promise<ListenerAddresses> {
  const reader = stdout.getReader();
  const decoder = new TextDecoder();
  let bufferedText = "";
  while (true) {
    const { done: isDone, value: chunk } = await reader.read();
    if (isDone) {
      throw new Error("sendmock exited before it was ready");
    }
    bufferedText += decoder.decode(chunk, { stream: true });
    const lines = bufferedText.split("\n");
    bufferedText = lines.pop() ?? "";
    const readyLine = lines.find((line) => line.includes(readyMessage));
    if (readyLine) {
      void drainRemainingOutput(reader);
      const readyFields = (JSON.parse(readyLine) as ReadyLine).fields ?? {};
      const httpAddress = readyFields.http_addr ?? null;
      const smtpAddress = readyFields.smtp_addr ?? null;
      if (!httpAddress || !smtpAddress) {
        throw new Error("the ready line has no http_addr or smtp_addr");
      }
      return { httpAddress, smtpAddress };
    }
  }
}

async function drainRemainingOutput(
  reader: ReadableStreamDefaultReader<Uint8Array>,
) {
  while (!(await reader.read()).done) {
    // Reading keeps the pipe open until sendmock exits.
  }
}

export function check(isPassing: boolean, description: string) {
  if (!isPassing) {
    throw new Error(`Failed: ${description}`);
  }
  console.log(`ok   ${description}`);
}

export async function checkRunningBinary(baseUrl: string) {
  const healthResponse = await fetch(`${baseUrl}/api/v1/health`);
  check(
    healthResponse.status === 200 &&
      (await healthResponse.json()).status === "ok",
    "GET /api/v1/health answers 200 with status ok",
  );

  const infoResponse = await fetch(`${baseUrl}/api/v1/info`);
  const appInfo = await infoResponse.json();
  check(
    infoResponse.status === 200 && appInfo.database_path === "memory",
    "GET /api/v1/info answers with the in-memory database",
  );

  const indexResponse = await fetch(`${baseUrl}/`);
  check(
    indexResponse.status === 200 &&
      (indexResponse.headers.get("content-type") ?? "").includes("text/html") &&
      (await indexResponse.text()).includes('id="root"'),
    "GET / serves the embedded UI",
  );

  const deepLinkResponse = await fetch(`${baseUrl}/mail`);
  check(
    deepLinkResponse.status === 200 &&
      (await deepLinkResponse.text()).includes('id="root"'),
    "GET /mail serves the UI for a deep link",
  );

  const unknownApiResponse = await fetch(`${baseUrl}/api/v1/nothing-here`);
  check(
    unknownApiResponse.status === 404 &&
      (await unknownApiResponse.json()).error?.code === "not_found",
    "an unknown API path answers 404 with the contract error",
  );
}

export type RunningSendmock = {
  sendmock: Subprocess<"ignore", "pipe", "inherit">;
  httpAddress: string;
  smtpAddress: string;
};

/** Starts the binary and waits for its ready line; serve flags come from the caller. */
export async function startSendmock(
  binaryPath: string,
  serveArguments: string[],
): Promise<RunningSendmock> {
  const sendmock = Bun.spawn(
    [binaryPath, ...serveArguments, "--log-format", "json"],
    { stdout: "pipe", stderr: "inherit" },
  );
  const startupTimeout = setTimeout(() => sendmock.kill(), startupTimeoutMs);
  try {
    return {
      sendmock,
      ...(await readAddressesFromReadyLine(sendmock.stdout)),
    };
  } finally {
    clearTimeout(startupTimeout);
  }
}

/** Stops it the way Docker and service managers do, and returns the exit code. */
export async function stopSendmock(
  runningSendmock: RunningSendmock,
): Promise<number> {
  runningSendmock.sendmock.kill(
    process.platform === "win32" ? undefined : "SIGTERM",
  );
  return await runningSendmock.sendmock.exited;
}

export function withExecutableSuffix(binaryPath: string): string {
  return process.platform === "win32" && !binaryPath.endsWith(".exe")
    ? `${binaryPath}.exe`
    : binaryPath;
}

async function main() {
  const binaryArgument = process.argv[2];
  if (!binaryArgument) {
    console.error("Usage: bun scripts/binary-smoke-test.ts <path to sendmock>");
    process.exit(2);
  }
  const runningSendmock = await startSendmock(
    withExecutableSuffix(binaryArgument),
    [
      "--http-addr",
      "127.0.0.1:0",
      "--smtp-addr",
      "127.0.0.1:0",
      "--db",
      "memory",
    ],
  );
  try {
    await checkRunningBinary(`http://${runningSendmock.httpAddress}`);
  } finally {
    const exitCode = await stopSendmock(runningSendmock);
    if (process.platform !== "win32") {
      check(exitCode === 0, "SIGTERM stops it with exit code 0");
    }
  }
}

if (import.meta.main) {
  await main();
}
