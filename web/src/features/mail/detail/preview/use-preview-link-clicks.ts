import * as React from "react";

import { useClickEmailLink } from "@/lib/api/hooks/use-email-queries";
import { useOperationAvailability } from "@/lib/api/hooks/use-operation-availability";
import type { EmailDetail } from "@/lib/api/types";

/** The email link an anchor points at, as SendMock extracted it, or null. */
function findClickedEmailLink(
  clickTarget: EventTarget | null,
  emailLinks: string[],
): string | null {
  // The target belongs to the preview's own document, so `instanceof Element` (this page's
  // Element) is always false; ask for `closest` instead.
  const clickedElement = clickTarget as Element | null;
  if (typeof clickedElement?.closest !== "function") {
    return null;
  }
  const clickedAnchor = clickedElement.closest("a[href]");
  if (clickedAnchor === null) {
    return null;
  }
  const writtenHref = clickedAnchor.getAttribute("href") ?? "";
  const resolvedHref = (clickedAnchor as HTMLAnchorElement).href;

  return (
    emailLinks.find((emailLink) => emailLink === writtenHref) ??
    emailLinks.find((emailLink) => emailLink === resolvedHref) ??
    null
  );
}

/**
 * A click on one of the email's links in the preview still opens it in a new
 * tab, and also fires `email.clicked` with `source: "ui"` (EM-20.1). The
 * listener belongs to this page, so it runs although the preview never runs
 * scripts.
 */
export function usePreviewLinkClicks(email: EmailDetail) {
  const clickEmailLink = useClickEmailLink();
  const isClickServed = useOperationAvailability(
    "POST /api/v1/emails/{emailId}/clicks",
  ).isAvailable;
  const { mutate: sendClick } = clickEmailLink;

  return React.useCallback(
    (previewFrame: HTMLIFrameElement) => {
      const previewDocument = previewFrame.contentDocument;
      if (previewDocument === null || !isClickServed) {
        return;
      }
      previewDocument.addEventListener("click", (clickEvent) => {
        const clickedLink = findClickedEmailLink(
          clickEvent.target,
          email.extracted.links,
        );
        if (clickedLink !== null) {
          sendClick({ emailId: email.id, url: clickedLink, clickSource: "ui" });
        }
      });
    },
    [email.id, email.extracted.links, isClickServed, sendClick],
  );
}
