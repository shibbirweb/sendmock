import { basePath } from "@/lib/base-path";
import { cn } from "@/lib/utils";

import { AiInstallRun } from "./ai-install-run";

/**
 * The quick start's AI tab (WS-09.4): the prompt, copying it, then an AI coding
 * agent installing SendMock. The copy button copies the whole prompt.
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
    <div
      data-testid="quick-start-ai-prompt"
      hidden={!isSelected}
      className={cn("relative min-w-0", className)}
    >
      {/* Mounted when the tab opens, so the run plays from the start. */}
      {isSelected && <AiInstallRun installPrompt={installPrompt} />}
      {/* The whole prompt stays in the HTML, so an agent reading the page finds it. */}
      <pre hidden data-testid="quick-start-ai-full-prompt">
        {installPrompt}
      </pre>
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
        Copy the prompt, paste it into your AI coding agent and answer its
        questions. It shows every command before it runs it.
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
