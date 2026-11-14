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

  const buttonName = isCopied ? "Copied" : label;

  return (
    // The tooltip shows at once on hover or keyboard focus, where a native title waits a second;
    // it stays up while "Copied" is showing, so a click visibly worked.
    <span className={cn("group relative inline-flex", className)}>
      <button
        type="button"
        onClick={copyCommand}
        aria-label={buttonName}
        className="rounded-md p-1.5 text-fd-muted-foreground transition-colors outline-none hover:bg-fd-accent hover:text-fd-accent-foreground focus-visible:ring-2 focus-visible:ring-(--brand-from)"
      >
        {isCopied ? (
          <CheckIcon aria-hidden className="size-4" />
        ) : (
          <CopyIcon aria-hidden className="size-4" />
        )}
      </button>
      {/* The button already carries this text as its name, so screen readers skip the copy. */}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute top-full right-0 z-20 mt-1.5 rounded-md bg-fd-primary px-2 py-1 text-xs font-medium whitespace-nowrap text-fd-primary-foreground shadow-md transition-opacity",
          isCopied
            ? "opacity-100"
            : "opacity-0 group-hover:opacity-100 group-has-[:focus-visible]:opacity-100",
        )}
      >
        {buttonName}
      </span>
    </span>
  );
}
