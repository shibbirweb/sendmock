import { ForwardIcon, ReplyAllIcon, ReplyIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  type EmailComposerMode,
  hasSeveralRecipients,
} from "@/features/mail/detail/response/email-composer-mode";
import type { EmailDetail } from "@/lib/api/types";

/** Reply, Reply all and Forward in the detail header; labels hide on phones. */
export function EmailResponseButtons({
  email,
  onStartResponse,
}: {
  email: EmailDetail;
  onStartResponse: (composerMode: EmailComposerMode) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="outline"
        size="sm"
        aria-keyshortcuts="R"
        onClick={() => {
          onStartResponse("reply");
        }}
      >
        <ReplyIcon />
        <span className="sr-only sm:not-sr-only">Reply</span>
      </Button>
      {hasSeveralRecipients(email) && (
        <Button
          variant="outline"
          size="sm"
          aria-keyshortcuts="Shift+R"
          onClick={() => {
            onStartResponse("reply_all");
          }}
        >
          <ReplyAllIcon />
          <span className="sr-only sm:not-sr-only">Reply all</span>
        </Button>
      )}
      <Button
        variant="outline"
        size="sm"
        aria-keyshortcuts="F"
        onClick={() => {
          onStartResponse("forward");
        }}
      >
        <ForwardIcon />
        <span className="sr-only sm:not-sr-only">Forward</span>
      </Button>
    </div>
  );
}
