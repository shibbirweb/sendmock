import * as React from "react";

/** Sets the browser tab title while the page is open. */
export function useDocumentTitle(documentTitle: string) {
  React.useEffect(() => {
    document.title = documentTitle;
  }, [documentTitle]);
}

/**
 * The tab title of a screen (UI-07.4): the open item first, then the
 * screen, then "SendMock", e.g. "Re: Reset your password · Mail · SendMock".
 * Empty parts (an item still loading) are left out.
 */
export function usePageTitle(...titleParts: (string | null | undefined)[]) {
  useDocumentTitle(
    [...titleParts.filter((titlePart) => titlePart), "SendMock"].join(" · "),
  );
}
