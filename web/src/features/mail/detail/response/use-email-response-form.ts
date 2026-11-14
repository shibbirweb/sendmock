import { useNavigate, useRouter } from "@tanstack/react-router";
import * as React from "react";
import { toast } from "sonner";

import {
  canSendResponse,
  type EmailComposerMode,
  listOriginalRecipients,
} from "@/features/mail/detail/response/email-composer-mode";
import { showResponseSentToast } from "@/features/mail/detail/response/show-response-sent-toast";
import { ApiError } from "@/lib/api/api-client";
import {
  useForwardEmail,
  useReplyToEmail,
} from "@/lib/api/hooks/use-email-response-queries";
import type { EmailDetail, WebhookChoice } from "@/lib/api/types";
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
  const router = useRouter();
  const hasDestinationsRef = React.useRef(false);
  const replyToEmail = useReplyToEmail();
  const forwardEmail = useForwardEmail();
  const [initialValues] = React.useState(() =>
    buildInitialValues(email, composerMode),
  );
  const [formValues, setFormValues] = React.useState(initialValues);
  const isForward = composerMode === "forward";
  const isSending = replyToEmail.isPending || forwardEmail.isPending;
  const hasDraftChanges = formValues.messageText !== initialValues.messageText;
  const canSend = canSendResponse(composerMode, formValues.forwardToAddress);

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
    showResponseSentToast({
      createdEmailId: createdEmail.id,
      isForward,
      isExpectingRequests: hasDestinationsRef.current,
      router,
      onOpen: () => {
        void navigate({
          to: "/mail/$emailId",
          params: { emailId: createdEmail.id },
          search: (previousSearch) => previousSearch,
        });
      },
    });
  };
  const mutationCallbacks = {
    onSuccess: handleSent,
    onError: (requestError: unknown) => {
      toast.error(readErrorMessage(requestError));
    },
  };

  /**
   * Sends; `hasDestinations` is what Delivers to and Webhooks showed at that
   * moment, and `webhookChoice` the endpoints chosen for this one send.
   */
  const sendResponse = (
    hasDestinations: boolean,
    webhookChoice: WebhookChoice,
  ) => {
    if (!canSend || isSending) {
      return;
    }
    hasDestinationsRef.current = hasDestinations;

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
            ...webhookChoice,
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
          ...webhookChoice,
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
