import { CheckIcon, CopyIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Icon button that copies text and shows a tick for a moment. */
export function CopyButton({
  copyText,
  label,
  className,
}: {
  copyText: string;
  label: string;
  className?: string;
}) {
  const [isCopied, setIsCopied] = React.useState(false);

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("size-7", className)}
      aria-label={label}
      onClick={() => {
        void navigator.clipboard.writeText(copyText).then(() => {
          setIsCopied(true);
          setTimeout(() => {
            setIsCopied(false);
          }, 1500);
        });
      }}
    >
      {isCopied ? <CheckIcon /> : <CopyIcon />}
    </Button>
  );
}
