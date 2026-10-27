import { basePath } from "@/lib/base-path";
import { cn } from "@/lib/utils";

import { CopyCommandButton } from "./copy-command-button";

/**
 * The quick start's AI tab (WS-09.4): the Install with AI prompt in a window the
 * size of the terminal, scrolling inside it so the panel keeps one height.
 */
export function AiInstallPromptWindow({
  installPrompt,
  isSelected,
  className,
}: {
  installPrompt: string;
  isSelected: boolean;
  className?: string;
}) {
  return (
    // Kept in the HTML while another tab is open, so an agent reading the page finds the prompt.
    <div
      data-testid="quick-start-ai-prompt"
      hidden={!isSelected}
      className={cn("relative min-w-0", className)}
    >
      <div className="absolute inset-0 flex flex-col rounded-xl border bg-fd-background">
        <div className="flex items-center justify-between gap-2 border-b px-4 py-2">
          <span className="text-sm font-medium">
            Paste this prompt into your AI coding agent
          </span>
          <CopyCommandButton
            command={installPrompt}
            label="Copy the install prompt"
          />
        </div>
        <pre className="min-h-0 flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">
          {installPrompt}
        </pre>
      </div>
    </div>
  );
}

/** Where the download buttons sit on the other tabs. */
export function AiInstallLinks({
  isSelected,
  className,
}: {
  isSelected: boolean;
  className?: string;
}) {
  return (
    <div
      data-testid="quick-start-ai-links"
      hidden={!isSelected}
      className={cn(
        "mt-6 flex flex-col items-center gap-2 text-center text-sm",
        className,
      )}
    >
      <p className="text-fd-muted-foreground">
        It checks your computer, asks whether you want Docker or the binary, and
        shows every command before it runs it.
      </p>
      <p className="flex flex-wrap justify-center gap-x-4 gap-y-1">
        <a
          href={`${basePath}/docs/install/#install-with-ai`}
          className="font-medium underline underline-offset-4"
        >
          Step by step
        </a>
        <a
          href={`${basePath}/llms.txt`}
          className="font-medium underline underline-offset-4"
        >
          llms.txt for AI agents
        </a>
      </p>
    </div>
  );
}
