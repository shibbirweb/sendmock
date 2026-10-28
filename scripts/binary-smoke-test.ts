#!/usr/bin/env bun
/**
 * Starts a built `sendmock` binary and checks that it serves the API and the embedded UI,
 * then stops it (the Phase 0 done-when check, docs/plan/23-phase-0.md).
 *
 *     bun scripts/binary-smoke-test.ts target/release/sendmock
 */

const startupTimeoutMs = 30_000;
const readyMessage = "SendMock is ready";

type ReadyLine = { fields?: { http_addr?: string } };

/** Reads stdout until the ready line, then keeps draining it so later log lines can be written. */
async function readHttpAddressFromReadyLine(
  stdout: ReadableStream<Uint8Array>,
): Promise<string> {
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
      const httpAddress =
        (JSON.parse(readyLine) as ReadyLine).fields?.http_addr ?? null;
      if (!httpAddress) {
        throw new Error("the ready line has no http_addr");
      }
      return httpAddress;
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

function check(isPassing: boolean, description: string) {
  if (!isPassing) {
    throw new Error(`Failed: ${description}`);
  }
  console.log(`ok   ${description}`);
}

async function checkRunningBinary(baseUrl: string) {
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

async function main() {
  const binaryArgument = process.argv[2];
  if (!binaryArgument) {
    console.error("Usage: bun scripts/binary-smoke-test.ts <path to sendmock>");
    process.exit(2);
  }
  const binaryPath =
    process.platform === "win32" && !binaryArgument.endsWith(".exe")
      ? `${binaryArgument}.exe`
      : binaryArgument;
  const sendmock = Bun.spawn(
    [
      binaryPath,
      "--http-addr",
      "127.0.0.1:0",
      "--db",
      "memory",
      "--log-format",
      "json",
    ],
    { stdout: "pipe", stderr: "inherit" },
  );
  const startupTimeout = setTimeout(() => sendmock.kill(), startupTimeoutMs);
  try {
    const httpAddress = await readHttpAddressFromReadyLine(sendmock.stdout);
    clearTimeout(startupTimeout);
    await checkRunningBinary(`http://${httpAddress}`);
  } finally {
    clearTimeout(startupTimeout);
    sendmock.kill(process.platform === "win32" ? undefined : "SIGTERM");
  }
  const exitCode = await sendmock.exited;
  if (process.platform !== "win32") {
    check(exitCode === 0, "SIGTERM stops it with exit code 0");
  }
}

await main();
