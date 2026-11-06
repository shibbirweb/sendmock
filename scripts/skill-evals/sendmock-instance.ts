import type { Subprocess } from "bun";

import type { BeforeRequest } from "./eval-case";

/** The address the plugin's MCP server reaches by default (`sendmock mcp` without flags). */
export const defaultBaseUrl = "http://127.0.0.1:8025";

export type SendmockInstance = {
  baseUrl: string;
  readJson: (path: string) => Promise<unknown>;
  stop: () => Promise<void>;
};

async function waitForHealth(baseUrl: string, serverProcess: Subprocess) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (serverProcess.exitCode !== null) {
      throw new Error(`sendmock serve exited with ${serverProcess.exitCode}`);
    }
    const isHealthy = await fetch(`${baseUrl}/api/v1/health`)
      .then((response) => response.ok)
      .catch(() => false);
    if (isHealthy) {
      return;
    }
    await Bun.sleep(500);
  }
  throw new Error(`sendmock did not answer at ${baseUrl} within 30 seconds`);
}

/** A fresh in-memory SendMock on the default ports, loaded with the case's seed file. */
export async function startSendmock(
  binaryPath: string,
  seedPath: string | null,
): Promise<SendmockInstance> {
  const serveArguments = ["serve", "--db", "memory", "--log-level", "warn"];
  const serverProcess = Bun.spawn(
    [
      binaryPath,
      ...serveArguments,
      ...(seedPath === null ? [] : ["--seed", seedPath]),
    ],
    { stdout: "ignore", stderr: "inherit" },
  );
  const baseUrl = defaultBaseUrl;
  await waitForHealth(baseUrl, serverProcess);
  return {
    baseUrl,
    readJson: async (path) => {
      const response = await fetch(`${baseUrl}${path}`);
      if (!response.ok) {
        throw new Error(`GET ${path} answered ${response.status}`);
      }
      return response.json();
    },
    stop: async () => {
      serverProcess.kill();
      await serverProcess.exited;
    },
  };
}

/** Sends the traffic the case starts from; any answer other than 2xx fails the case. */
export async function sendBeforeRequests(
  baseUrl: string,
  beforeRequests: BeforeRequest[],
) {
  for (const beforeRequest of beforeRequests) {
    const response = await fetch(`${baseUrl}${beforeRequest.path}`, {
      method: "POST",
      headers:
        beforeRequest.form === undefined
          ? { "content-type": "application/json" }
          : { "content-type": "application/x-www-form-urlencoded" },
      body:
        beforeRequest.form === undefined
          ? JSON.stringify(beforeRequest.json ?? {})
          : new URLSearchParams(beforeRequest.form).toString(),
    });
    if (!response.ok) {
      throw new Error(
        `POST ${beforeRequest.path} answered ${response.status}: ${await response.text()}`,
      );
    }
  }
}

/** The tools `sendmock mcp` lists with its default toolsets, as the plugin starts it. */
export async function listMcpToolNames(binaryPath: string): Promise<string[]> {
  const mcpProcess = Bun.spawn([binaryPath, "mcp"], {
    stdin: "pipe",
    stdout: "pipe",
    stderr: "inherit",
  });
  const messages = [
    {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "skill-evals", version: "1" },
      },
    },
    { jsonrpc: "2.0", method: "notifications/initialized" },
    { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
  ];
  mcpProcess.stdin.write(
    messages.map((message) => JSON.stringify(message)).join("\n") + "\n",
  );
  mcpProcess.stdin.flush();
  const toolNames = await readToolNames(mcpProcess.stdout);
  mcpProcess.kill();
  return toolNames;
}

async function readToolNames(
  output: ReadableStream<Uint8Array>,
): Promise<string[]> {
  const decoder = new TextDecoder();
  let pendingText = "";
  for await (const chunk of output) {
    pendingText += decoder.decode(chunk, { stream: true });
    const lines = pendingText.split("\n");
    pendingText = lines.pop() ?? "";
    for (const line of lines) {
      const message = JSON.parse(line) as {
        id?: number;
        result?: { tools?: { name: string }[] };
      };
      if (message.id === 2) {
        return (message.result?.tools ?? []).map((tool) => tool.name);
      }
    }
  }
  throw new Error("sendmock mcp closed before it listed its tools");
}
