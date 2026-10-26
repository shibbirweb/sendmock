"use client";

import {
  AnimatedSpan,
  Terminal,
  TerminalWindow,
  TypingAnimation,
} from "@/components/ui/terminal";
import { cn } from "@/lib/utils";

import type { InstallPlatform } from "./install-platforms";

type TerminalLine = {
  text: string;
  kind: "command" | "success" | "output";
};

/** Long commands wrap instead of scrolling sideways, and type faster. */
const commandLineClassName = "whitespace-pre-wrap break-all";
/** The same text classes the terminal gives its typed and animated lines. */
const lineTextClassName = "text-sm font-normal tracking-tight";

function listTerminalLines(installPlatform: InstallPlatform): TerminalLine[] {
  const { prompt, listenHost } = installPlatform;
  return [
    { text: `${prompt} ${installPlatform.installCommand}`, kind: "command" },
    { text: installPlatform.installedMessage, kind: "success" },
    { text: `${prompt} ${installPlatform.runCommand}`, kind: "command" },
    { text: `SMTP listening on ${listenHost}:1025`, kind: "output" },
    { text: `Web UI and API on http://${listenHost}:8025`, kind: "output" },
  ];
}

/** Types the platform's install and run commands, then shows the server starting. */
export function InstallTerminal({
  installPlatform,
}: {
  installPlatform: InstallPlatform;
}) {
  return (
    <Terminal className="max-w-2xl">
      {listTerminalLines(installPlatform).map((terminalLine, lineIndex) =>
        terminalLine.kind === "command" ? (
          <TypingAnimation
            key={lineIndex}
            className={commandLineClassName}
            duration={25}
          >
            {terminalLine.text}
          </TypingAnimation>
        ) : (
          <AnimatedSpan
            key={lineIndex}
            className={cn(terminalLine.kind === "success" && "text-fd-primary")}
          >
            {terminalLine.text}
          </AnimatedSpan>
        ),
      )}
    </Terminal>
  );
}

/**
 * The finished terminal, invisible and hidden from assistive technology, so the
 * panel keeps the height of the tallest platform while lines type and tabs change.
 */
export function InstallTerminalPlaceholder({
  installPlatform,
  className,
}: {
  installPlatform: InstallPlatform;
  className?: string;
}) {
  return (
    <div aria-hidden className={cn("invisible min-w-0", className)}>
      <TerminalWindow className="max-w-2xl">
        {listTerminalLines(installPlatform).map((terminalLine, lineIndex) => (
          <div
            key={lineIndex}
            className={cn(
              lineTextClassName,
              terminalLine.kind === "command" ? commandLineClassName : "grid",
            )}
          >
            {terminalLine.text}
          </div>
        ))}
      </TerminalWindow>
    </div>
  );
}
