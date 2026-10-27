"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

const copiedIndicatorDurationMs = 2000;

/** Copies a shell command, without its prompt, and briefly confirms it. */
export function CopyCommandButton({
  command,
  label = "Copy the install command",
  isShowingCopied = false,
  className,
}: {
  command: string;
  /** What the button copies, for its name and tooltip. */
  label?: string;
  /** Shows the copied look without copying, for the AI tab's demo click. */
  isShowingCopied?: boolean;
  className?: string;
}) {
  const [isCopiedByClick, setIsCopiedByClick] = useState(false);
  const isCopied = isCopiedByClick || isShowingCopied;

  useEffect(() => {
    if (!isCopiedByClick) {
      return;
    }
    const resetTimer = setTimeout(
      () => setIsCopiedByClick(false),
      copiedIndicatorDurationMs,
    );
    return () => clearTimeout(resetTimer);
  }, [isCopiedByClick]);

  const copyCommand = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setIsCopiedByClick(true);
    } catch {
      // The clipboard is unavailable (an insecure page or a denied permission); the command stays selectable.
    }
  };

  return (
    <button
      type="button"
      onClick={copyCommand}
      aria-label={isCopied ? "Copied" : label}
      title={isCopied ? "Copied" : label}
      className={cn(
        "rounded-md p-1.5 text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground",
        className,
      )}
    >
      {isCopied ? (
        <CheckIcon aria-hidden className="size-4" />
      ) : (
        <CopyIcon aria-hidden className="size-4" />
      )}
    </button>
  );
}
