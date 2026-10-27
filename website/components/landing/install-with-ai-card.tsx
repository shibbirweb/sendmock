import { SparklesIcon } from "lucide-react";

import { basePath } from "@/lib/base-path";
import { readInstallPrompt } from "@/lib/install-with-ai/read-install-prompt";

import { CopyCommandButton } from "./copy-command-button";

/**
 * The "Install with AI" card under the quick start (WS-09.4). The whole prompt
 * is in the page HTML, so an agent given only the site's address finds it.
 */
export function InstallWithAiCard() {
  const installPrompt = readInstallPrompt();
  if (installPrompt === null) {
    return null;
  }

  return (
    <div
      data-testid="install-with-ai-card"
      className="flex w-full max-w-2xl flex-col gap-3 rounded-xl border bg-fd-card p-5"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-fd-background text-(--brand-text)">
          <SparklesIcon aria-hidden="true" className="size-4" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="font-semibold">Install with AI</h3>
          <p className="text-sm text-fd-muted-foreground">
            Paste this prompt into your AI coding agent. It checks your
            computer, asks whether you want Docker or the binary, and shows
            every command before it runs it.
          </p>
        </div>
        <CopyCommandButton
          command={installPrompt}
          label="Copy the install prompt"
          className="shrink-0 border"
        />
      </div>
      <details className="group rounded-lg border bg-fd-background text-sm">
        <summary className="cursor-pointer px-3 py-2 font-medium">
          Show the prompt
        </summary>
        <pre className="max-h-80 overflow-auto border-t px-3 py-2 text-xs whitespace-pre-wrap">
          {installPrompt}
        </pre>
      </details>
      <p className="text-xs text-fd-muted-foreground">
        AI agents: step-by-step install instructions are in{" "}
        <a
          href={`${basePath}/llms.txt`}
          className="font-medium text-fd-foreground underline underline-offset-4"
        >
          llms.txt
        </a>
        .
      </p>
    </div>
  );
}
