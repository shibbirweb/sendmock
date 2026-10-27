import {
  CheckCircle2Icon,
  SparklesIcon,
  TerminalSquareIcon,
} from "lucide-react";
import type { ReactNode } from "react";

/**
 * One message of the AI tab's agent run (WS-09.4). Your messages are written
 * in the message box first; the agent's appear after it has thought.
 */
export type ConversationEntry =
  | { speaker: "you"; text: string; isPasted: boolean }
  | { speaker: "agent"; content: ReactNode };

/** Your pasted prompt, the agent checking and asking, your answers, the result. */
export function buildConversation(installPrompt: string): ConversationEntry[] {
  return [
    { speaker: "you", text: installPrompt, isPasted: true },
    {
      speaker: "agent",
      content: (
        <p>
          I checked this computer: macOS on Apple silicon, Docker is running and
          Homebrew is installed.
        </p>
      ),
    },
    {
      speaker: "agent",
      content: (
        <>
          <p className="font-medium">How do you want to run SendMock?</p>
          <p>
            <span className="font-medium">Docker or the binary?</span> Docker
            keeps your computer clean and is easy to remove. The binary starts
            instantly and needs no Docker.
          </p>
        </>
      ),
    },
    { speaker: "you", text: "The binary, stable", isPasted: false },
    {
      speaker: "agent",
      content: (
        <div className="flex flex-col gap-1 rounded-lg border p-3">
          <span className="flex items-center gap-1.5 text-xs font-medium text-fd-muted-foreground">
            <TerminalSquareIcon aria-hidden="true" className="size-3.5" />
            Run command
          </span>
          <code className="font-mono text-xs break-all">
            brew install shibbirweb/tap/sendmock
          </code>
          <span className="text-xs text-fd-muted-foreground">
            Installs the stable SendMock with Homebrew. OK to run?
          </span>
        </div>
      ),
    },
    { speaker: "you", text: "OK", isPasted: false },
    {
      speaker: "agent",
      content: (
        <>
          <p className="flex items-center gap-1.5 font-medium text-(--brand-text)">
            <CheckCircle2Icon aria-hidden="true" className="size-4" />
            SendMock is running
          </p>
          <p className="text-fd-muted-foreground">
            Web UI http://127.0.0.1:8025 · SMTP 127.0.0.1:1025
          </p>
        </>
      ),
    },
  ];
}

function AgentLabel() {
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-(--brand-text)">
      <SparklesIcon aria-hidden="true" className="size-3.5" />
      Agent
    </span>
  );
}

/** A sent message, as the agent's chat shows it. */
export function ConversationMessage({
  conversationEntry,
}: {
  conversationEntry: ConversationEntry;
}) {
  if (conversationEntry.speaker === "agent") {
    return (
      <div className="flex flex-col gap-1">
        <AgentLabel />
        <div className="flex flex-col gap-1.5">{conversationEntry.content}</div>
      </div>
    );
  }

  return conversationEntry.isPasted ? (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-fd-muted-foreground">You</span>
      <div className="min-w-0 rounded-lg border bg-fd-secondary/50 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">
        {conversationEntry.text}
      </div>
    </div>
  ) : (
    <div className="max-w-[80%] self-end rounded-lg bg-fd-secondary px-3 py-1.5">
      {conversationEntry.text}
    </div>
  );
}

/** Shown while the agent works on its next reply. */
export function ThinkingIndicator() {
  return (
    <div className="flex flex-col gap-1">
      <AgentLabel />
      <span className="animate-pulse text-xs text-fd-muted-foreground">
        Thinking…
      </span>
    </div>
  );
}
