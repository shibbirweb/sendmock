import type { Subprocess } from "bun";

/** What one `tools/call` answered: its text content, and whether the tool reported an error. */
export type McpToolAnswer = { text: string; isError: boolean };

type JsonRpcMessage = {
  id?: number;
  result?: {
    tools?: { name: string }[];
    content?: { type: string; text?: string }[];
    isError?: boolean;
  };
  error?: { message?: string };
};

/**
 * A `sendmock mcp` process spoken to over stdio, as the plugin starts it: with its default
 * toolsets, reaching the instance on the default ports.
 */
export class McpSession {
  private nextRequestId = 1;
  private pendingText = "";
  private readonly decoder = new TextDecoder();
  private readonly outputReader: ReadableStreamDefaultReader<Uint8Array>;

  private constructor(
    private readonly mcpProcess: Subprocess<"pipe", "pipe", "inherit">,
  ) {
    this.outputReader = mcpProcess.stdout.getReader();
  }

  static async start(binaryPath: string): Promise<McpSession> {
    const mcpSession = new McpSession(
      Bun.spawn([binaryPath, "mcp"], {
        stdin: "pipe",
        stdout: "pipe",
        stderr: "inherit",
      }),
    );
    await mcpSession.request("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "skill-evals", version: "1" },
    });
    mcpSession.send({ jsonrpc: "2.0", method: "notifications/initialized" });
    return mcpSession;
  }

  async listToolNames(): Promise<string[]> {
    const answer = await this.request("tools/list", {});
    return (answer.result?.tools ?? []).map((tool) => tool.name);
  }

  async callTool(toolName: string, toolInput: unknown): Promise<McpToolAnswer> {
    const answer = await this.request("tools/call", {
      name: toolName,
      arguments: toolInput ?? {},
    });
    if (answer.error !== undefined) {
      return { text: answer.error.message ?? "", isError: true };
    }
    return {
      text: (answer.result?.content ?? [])
        .map((contentPart) => contentPart.text ?? "")
        .join("\n"),
      isError: answer.result?.isError === true,
    };
  }

  async close(): Promise<void> {
    this.mcpProcess.kill();
    await this.mcpProcess.exited;
  }

  private send(message: Record<string, unknown>) {
    this.mcpProcess.stdin.write(`${JSON.stringify(message)}\n`);
    this.mcpProcess.stdin.flush();
  }

  private async request(
    method: string,
    params: Record<string, unknown>,
  ): Promise<JsonRpcMessage> {
    const requestId = this.nextRequestId;
    this.nextRequestId += 1;
    this.send({ jsonrpc: "2.0", id: requestId, method, params });
    return this.readAnswer(requestId);
  }

  /** Skips notifications and blank lines until the answer to `requestId` arrives. */
  private async readAnswer(requestId: number): Promise<JsonRpcMessage> {
    for (;;) {
      const line = await this.readLine(requestId);
      if (line.trim() === "") {
        continue;
      }
      const message = JSON.parse(line) as JsonRpcMessage;
      if (message.id === requestId) {
        return message;
      }
    }
  }

  private async readLine(requestId: number): Promise<string> {
    for (;;) {
      const newlineIndex = this.pendingText.indexOf("\n");
      if (newlineIndex >= 0) {
        const line = this.pendingText.slice(0, newlineIndex);
        this.pendingText = this.pendingText.slice(newlineIndex + 1);
        return line;
      }
      const chunk = await this.outputReader.read();
      if (chunk.done) {
        throw new Error(
          `sendmock mcp closed before it answered request ${requestId}`,
        );
      }
      this.pendingText += this.decoder.decode(chunk.value, { stream: true });
    }
  }
}
