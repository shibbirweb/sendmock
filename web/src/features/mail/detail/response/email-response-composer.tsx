import { ForwardIcon, ReplyIcon, XIcon } from "lucide-react";
import * as React from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  composerHeadings,
  type EmailComposerMode,
} from "@/features/mail/detail/response/email-composer-mode";
import { EmailResponseFields } from "@/features/mail/detail/response/email-response-fields";
import { useEmailResponseForm } from "@/features/mail/detail/response/use-email-response-form";
import type { EmailDetail } from "@/lib/api/types";

type EmailResponseComposerProps = {
  email: EmailDetail;
  composerMode: EmailComposerMode;
  onClose: () => void;
};

function DiscardDraftDialog({
  isOpen,
  onOpenChange,
  onDiscard,
  onKeepWriting,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onDiscard: () => void;
  /** Puts focus back in the message box, so Esc keeps working. */
  onKeepWriting: () => void;
}) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent
        onCloseAutoFocus={(focusEvent) => {
          focusEvent.preventDefault();
          onKeepWriting();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Discard this message?</AlertDialogTitle>
          <AlertDialogDescription>
            The text you wrote will be lost.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep writing</AlertDialogCancel>
          <AlertDialogAction onClick={onDiscard}>Discard</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Inline composer that simulates the recipient replying to or forwarding the
 * email (EM-17). Like Gmail, the original sits in the message box below an
 * empty first line. Ctrl/Cmd+Enter sends, Esc closes.
 */
export function EmailResponseComposer({
  email,
  composerMode,
  onClose,
}: EmailResponseComposerProps) {
  const messageFieldId = React.useId();
  const attachmentsFieldId = React.useId();
  const messageFieldRef = React.useRef<HTMLTextAreaElement>(null);
  const [isDiscardDialogOpen, setDiscardDialogOpen] = React.useState(false);
  const {
    formValues,
    updateFormValues,
    hasDraftChanges,
    canSend,
    isSending,
    sendResponse,
  } = useEmailResponseForm({ email, composerMode, onSent: onClose });
  const isForward = composerMode === "forward";

  // Replies start typing above the quote; forwards start in the To field.
  React.useEffect(() => {
    const messageField = messageFieldRef.current;
    if (isForward || messageField === null) {
      return;
    }

    messageField.focus();
    messageField.setSelectionRange(0, 0);
    messageField.scrollTop = 0;
  }, [isForward]);

  const closeComposer = () => {
    if (hasDraftChanges) {
      setDiscardDialogOpen(true);
      return;
    }

    onClose();
  };

  return (
    <section
      aria-label={composerHeadings[composerMode]}
      className="mx-4 mt-4 grid gap-3 rounded-lg border bg-card p-4 shadow-xs sm:mx-6"
      onKeyDown={(keyboardEvent) => {
        if (keyboardEvent.key === "Escape" && !isDiscardDialogOpen) {
          keyboardEvent.stopPropagation();
          closeComposer();
        } else if (
          keyboardEvent.key === "Enter" &&
          (keyboardEvent.metaKey || keyboardEvent.ctrlKey)
        ) {
          keyboardEvent.preventDefault();
          sendResponse();
        }
      }}
    >
      <div className="flex items-center gap-2">
        {isForward ? (
          <ForwardIcon className="size-4 text-muted-foreground" />
        ) : (
          <ReplyIcon className="size-4 text-muted-foreground" />
        )}
        <h3 className="flex-1 text-sm font-semibold">
          {composerHeadings[composerMode]}
        </h3>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Close composer"
          onClick={closeComposer}
        >
          <XIcon />
        </Button>
      </div>
      <EmailResponseFields
        email={email}
        composerMode={composerMode}
        formValues={formValues}
        onChange={updateFormValues}
      />
      <Label htmlFor={messageFieldId} className="sr-only">
        Message
      </Label>
      <Textarea
        ref={messageFieldRef}
        id={messageFieldId}
        rows={10}
        className="max-h-96 leading-relaxed"
        value={formValues.messageText}
        onChange={(changeEvent) => {
          updateFormValues({ messageText: changeEvent.target.value });
        }}
      />
      {isForward && email.attachment_count > 0 && (
        <div className="flex items-center gap-2">
          <Checkbox
            id={attachmentsFieldId}
            checked={formValues.shouldIncludeAttachments}
            onCheckedChange={(checkedState) => {
              updateFormValues({
                shouldIncludeAttachments: checkedState === true,
              });
            }}
          />
          <Label htmlFor={attachmentsFieldId} className="font-normal">
            Include attachments ({email.attachment_count})
          </Label>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={!canSend || isSending} onClick={sendResponse}>
          {isForward ? <ForwardIcon /> : <ReplyIcon />}
          {isForward ? "Send forward" : "Send reply"}
        </Button>
        <Button variant="ghost" onClick={closeComposer}>
          Cancel
        </Button>
        <p className="text-xs text-muted-foreground sm:ml-auto">
          Creates an incoming email (<code>email.inbound</code>). Inbound routes
          deliver it to your app.
        </p>
      </div>
      <DiscardDraftDialog
        isOpen={isDiscardDialogOpen}
        onOpenChange={setDiscardDialogOpen}
        onDiscard={onClose}
        onKeepWriting={() => {
          messageFieldRef.current?.focus();
        }}
      />
    </section>
  );
}
