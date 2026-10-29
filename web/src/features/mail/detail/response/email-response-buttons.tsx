import { ForwardIcon, ReplyAllIcon, ReplyIcon } from "lucide-react";

import { OperationButton } from "@/features/availability/operation-button";
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
      <OperationButton
        operationKey="POST /api/v1/emails/{emailId}/reply"
        actionName="Reply"
        variant="outline"
        size="sm"
        aria-keyshortcuts="R"
        onClick={() => {
          onStartResponse("reply");
        }}
      >
        <ReplyIcon />
        <span className="sr-only sm:not-sr-only">Reply</span>
      </OperationButton>
      {hasSeveralRecipients(email) && (
        <OperationButton
          operationKey="POST /api/v1/emails/{emailId}/reply"
          actionName="Reply all"
          variant="outline"
          size="sm"
          aria-keyshortcuts="Shift+R"
          onClick={() => {
            onStartResponse("reply_all");
          }}
        >
          <ReplyAllIcon />
          <span className="sr-only sm:not-sr-only">Reply all</span>
        </OperationButton>
      )}
      <OperationButton
        operationKey="POST /api/v1/emails/{emailId}/forward"
        actionName="Forward"
        variant="outline"
        size="sm"
        aria-keyshortcuts="F"
        onClick={() => {
          onStartResponse("forward");
        }}
      >
        <ForwardIcon />
        <span className="sr-only sm:not-sr-only">Forward</span>
      </OperationButton>
    </div>
  );
}
