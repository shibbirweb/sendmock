import {
  CheckIcon,
  CopyIcon,
  ExternalLinkIcon,
  KeyRoundIcon,
} from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import type { ExtractedData } from "@/lib/api/types";

function CopyButton({ copyText, label }: { copyText: string; label: string }) {
  const [isCopied, setIsCopied] = React.useState(false);

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-7"
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

/** OTP codes and links found in the email, one click to copy (EM-05.4). */
export function ExtractedDataPanel({
  extracted,
}: {
  extracted: ExtractedData;
}) {
  if (extracted.otp.length === 0 && extracted.links.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-2 border-b px-4 py-3 text-sm sm:px-6">
      {extracted.otp.map((otpCode) => (
        <div key={otpCode} className="flex items-center gap-2">
          <KeyRoundIcon className="size-4 text-muted-foreground" />
          <span className="text-muted-foreground">Code</span>
          <span className="rounded bg-muted px-2 py-0.5 font-mono text-base font-semibold tracking-widest">
            {otpCode}
          </span>
          <CopyButton copyText={otpCode} label={`Copy code ${otpCode}`} />
        </div>
      ))}
      {extracted.links.slice(0, 5).map((linkUrl) => (
        <div key={linkUrl} className="flex min-w-0 items-center gap-2">
          <ExternalLinkIcon className="size-4 shrink-0 text-muted-foreground" />
          <a
            href={linkUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="truncate text-primary underline-offset-2 hover:underline"
          >
            {linkUrl}
          </a>
          <CopyButton copyText={linkUrl} label="Copy link" />
        </div>
      ))}
    </div>
  );
}
