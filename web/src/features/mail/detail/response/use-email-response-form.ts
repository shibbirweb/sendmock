import { useNavigate } from "@tanstack/react-router";
import * as React from "react";
import { toast } from "sonner";

import {
  type EmailComposerMode,
  listOriginalRecipients,
} from "@/features/mail/detail/response/email-composer-mode";
import { ApiError } from "@/lib/api/api-client";
import {
  useForwardEmail,
  useReplyToEmail,
} from "@/lib/api/hooks/use-email-response-queries";
import type { EmailDetail } from "@/lib/api/types";
import { buildResponseSubject } from "@/lib/email/build-response-subject";
import {
  buildForwardedMessageBlock,
  formatEmailAddress,
  quoteOriginalEmail,
} from "@/lib/email/build-response-text";

export type EmailResponseFormValues = {
  fromAddress: string;
  forwardToAddress: string;
  subject: string;
  /** Starts with the original below an empty line, as Gmail does. */
  messageText: string;
  /** Forward only: carry the original attachments. */
  shouldIncludeAttachments: boolean;
};

function buildInitialMessageText(
  email: EmailDetail,
  composerMode: EmailComposerMode,
): string {
  const originalText =
    composerMode === "forward"
      ? buildForwardedMessageBlock(email)
      : quoteOriginalEmail(email);

  return `\n\n${originalText}`;
}

function buildInitialValues(
  email: EmailDetail,
  composerMode: EmailComposerMode,
): EmailResponseFormValues {
  const firstRecipient = listOriginalRecipients(email)[0];

  return {
    fromAddress:
      firstRecipient === undefined ? "" : formatEmailAddress(firstRecipient),
    forwardToAddress: "",
    subject: buildResponseSubject(
      email.subject,
      composerMode === "forward" ? "forward" : "reply",
    ),
    messageText: buildInitialMessageText(email, composerMode),
    shouldIncludeAttachments: true,
  };
}

function readErrorMessage(requestError: unknown): string {
  return requestError instanceof ApiError
    ? requestError.message
    : "Could not create the email";
}

/** State and sending for the reply / forward composer (container logic). */
export function useEmailResponseForm({
  email,
  composerMode,
  onSent,
}: {
  email: EmailDetail;
  composerMode: EmailComposerMode;
  onSent: () => void;
}) {
  const navigate = useNavigate();
  const replyToEmail = useReplyToEmail();
  const forwardEmail = useForwardEmail();
  const [initialValues] = React.useState(() =>
    buildInitialValues(email, composerMode),
  );
  const [formValues, setFormValues] = React.useState(initialValues);
  const isForward = composerMode === "forward";
  const isSending = replyToEmail.isPending || forwardEmail.isPending;
  const hasDraftChanges = formValues.messageText !== initialValues.messageText;
  // A reply needs new text; a forward only needs somewhere to go.
  const canSend = isForward
    ? formValues.forwardToAddress.includes("@")
    : hasDraftChanges && formValues.messageText.trim() !== "";

  const updateFormValues = (
    changedValues: Partial<EmailResponseFormValues>,
  ) => {
    setFormValues((previousValues) => ({
      ...previousValues,
      ...changedValues,
    }));
  };

  const handleSent = (createdEmail: EmailDetail) => {
    onSent();
    toast(isForward ? "Forward created" : "Reply created", {
      description: "Inbound routes deliver it to your app.",
      action: {
        label: "Open",
        onClick: () => {
          void navigate({
            to: "/mail/$emailId",
            params: { emailId: createdEmail.id },
            search: (previousSearch) => previousSearch,
          });
        },
      },
    });
  };
  const mutationCallbacks = {
    onSuccess: handleSent,
    onError: (requestError: unknown) => {
      toast.error(readErrorMessage(requestError));
    },
  };

  const sendResponse = () => {
    if (!canSend || isSending) {
      return;
    }

    if (isForward) {
      forwardEmail.mutate(
        {
          emailId: email.id,
          forwardRequest: {
            to: formValues.forwardToAddress,
            from: formValues.fromAddress,
            subject: formValues.subject,
            body: formValues.messageText,
            include_original: false,
            include_attachments: formValues.shouldIncludeAttachments,
          },
        },
        mutationCallbacks,
      );
      return;
    }

    replyToEmail.mutate(
      {
        emailId: email.id,
        replyRequest: {
          body: formValues.messageText,
          from: formValues.fromAddress,
          subject: formValues.subject,
          reply_all: composerMode === "reply_all",
          include_original: false,
        },
      },
      mutationCallbacks,
    );
  };

  return {
    formValues,
    updateFormValues,
    hasDraftChanges,
    canSend,
    isSending,
    sendResponse,
  };
}
