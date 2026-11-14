import { CheckIcon, CopyIcon } from "lucide-react";
import * as React from "react";

import { IconButton } from "@/components/common/icon-button";
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
    <IconButton
      variant="ghost"
      className={cn("size-7", className)}
      label={label}
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
    </IconButton>
  );
}
