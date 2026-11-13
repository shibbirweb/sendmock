import { type AnyRouter, RouterContextProvider } from "@tanstack/react-router";
import { toast } from "sonner";

import { EmailWebhookRequests } from "@/features/mail/detail/response/email-webhook-requests";

/** Long enough to watch the requests move from pending to their answers. */
const sentToastDurationMs = 10_000;

/**
 * "Reply created" with the webhook requests the new email caused (EM-22.5).
 * The toaster sits outside the router, so the links get it passed in.
 */
export function showResponseSentToast({
  createdEmailId,
  isForward,
  isExpectingRequests,
  router,
  onOpen,
}: {
  createdEmailId: string;
  isForward: boolean;
  isExpectingRequests: boolean;
  router: AnyRouter;
  onOpen: () => void;
}) {
  toast(isForward ? "Forward created" : "Reply created", {
    description: (
      <RouterContextProvider router={router}>
        <EmailWebhookRequests
          emailId={createdEmailId}
          isExpectingRequests={isExpectingRequests}
        />
      </RouterContextProvider>
    ),
    duration: sentToastDurationMs,
    action: { label: "Open", onClick: onOpen },
  });
}
