"use client";

import { CheckIcon, MousePointer2Icon, PlayIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import { AiAgentWindow } from "./ai-agent-window";
import { CopyCommandButton } from "./copy-command-button";

/**
 * The AI tab's three stages (WS-09.4): the prompt to read, copying it, then
 * the agent window it is pasted into.
 */
type RunStage = "prompt" | "pointing" | "copied" | "agent";

/** How long each stage lasts before the next one starts. */
const stageDurationsMs: Record<Exclude<RunStage, "agent">, number> = {
  prompt: 3000,
  pointing: 800,
  copied: 1400,
};
const nextStage: Record<Exclude<RunStage, "agent">, RunStage> = {
  prompt: "pointing",
  pointing: "copied",
  copied: "agent",
};

/** The prompt as you copy it from the docs, in a window like the terminals'. */
function PromptWindow({
  installPrompt,
  runStage,
  isWaitingForReader,
  onReaderScroll,
  onShowAgentRun,
}: {
  installPrompt: string;
  runStage: RunStage;
  isWaitingForReader: boolean;
  onReaderScroll: () => void;
  onShowAgentRun: () => void;
}) {
  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden rounded-xl border bg-fd-background">
      {/* The terminal's title bar size, so every tab's window lines up. */}
      <div className="box-content flex h-2 items-center gap-3 border-b p-4">
        <div aria-hidden="true" className="flex gap-x-2">
          <span className="size-2 rounded-full bg-red-500" />
          <span className="size-2 rounded-full bg-yellow-500" />
          <span className="size-2 rounded-full bg-green-500" />
        </div>
        <span className="text-xs font-medium">Install with AI prompt</span>
      </div>
      <pre
        data-testid="quick-start-ai-prompt-text"
        onWheel={onReaderScroll}
        onTouchStart={onReaderScroll}
        className={cn(
          "min-h-0 flex-1 overflow-y-auto p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap transition-colors duration-300 [overflow-wrap:anywhere]",
          // Copying selects the whole prompt, as a browser shows a selection.
          runStage === "copied" && "bg-(--brand-text)/15",
        )}
      >
        {installPrompt}
      </pre>
      {runStage === "copied" && (
        <motion.span
          role="status"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border bg-fd-background px-3 py-1 text-xs font-medium shadow-sm"
        >
          <CheckIcon
            aria-hidden="true"
            className="size-3.5 text-(--brand-text)"
          />
          Copied to clipboard
        </motion.span>
      )}
      {isWaitingForReader && (
        <button
          type="button"
          onClick={onShowAgentRun}
          className="absolute right-3 bottom-3 flex items-center gap-1.5 rounded-full bg-fd-primary px-3 py-1.5 text-xs font-medium text-fd-primary-foreground shadow-sm"
        >
          <PlayIcon aria-hidden="true" className="size-3.5" />
          Show the agent run
        </button>
      )}
    </div>
  );
}

/**
 * Mounted when the AI tab opens, so the run plays from the start. Scrolling the
 * prompt, or reduced motion, stops it on the prompt until the reader asks.
 */
export function AiInstallRun({ installPrompt }: { installPrompt: string }) {
  const shouldReduceMotion = useReducedMotion();
  const [runStage, setRunStage] = useState<RunStage>("prompt");
  const [isReaderInControl, setIsReaderInControl] = useState(false);
  const isWaitingForReader =
    runStage === "prompt" && (isReaderInControl || shouldReduceMotion === true);
  const stageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (runStage === "agent" || isWaitingForReader) {
      return;
    }
    stageTimerRef.current = setTimeout(
      () => setRunStage(nextStage[runStage]),
      stageDurationsMs[runStage],
    );

    return () => {
      if (stageTimerRef.current !== null) {
        clearTimeout(stageTimerRef.current);
      }
    };
  }, [runStage, isWaitingForReader]);

  return (
    <>
      <CopyCommandButton
        command={installPrompt}
        label="Copy the install prompt"
        isShowingCopied={runStage === "copied"}
        className={cn(
          "absolute top-1.5 right-2 z-10 transition-transform",
          runStage === "copied" && "scale-90",
        )}
      />
      {runStage === "agent" ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="absolute inset-0"
        >
          <AiAgentWindow installPrompt={installPrompt} />
        </motion.div>
      ) : (
        <PromptWindow
          installPrompt={installPrompt}
          runStage={runStage}
          isWaitingForReader={isWaitingForReader}
          onReaderScroll={() => setIsReaderInControl(true)}
          onShowAgentRun={() => setRunStage("agent")}
        />
      )}
      {(runStage === "pointing" || runStage === "copied") && (
        // A pointer moves onto the copy button and clicks it.
        <motion.span
          aria-hidden="true"
          initial={{ x: -120, y: 90, opacity: 0 }}
          animate={{
            x: 0,
            y: 0,
            opacity: 1,
            scale: runStage === "copied" ? 0.85 : 1,
          }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="pointer-events-none absolute top-[1.375rem] right-2.5 z-20 text-fd-foreground drop-shadow"
        >
          <MousePointer2Icon className="size-5 fill-fd-background" />
        </motion.span>
      )}
    </>
  );
}
