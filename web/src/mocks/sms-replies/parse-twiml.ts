import type { TwimlVerb } from "@/lib/api/types";

export type TwimlParseResult =
  { isValid: true; verbs: TwimlVerb[] } | { isValid: false; message: string };

function readChildText(messageElement: Element, childName: string): string[] {
  return [...messageElement.getElementsByTagName(childName)].map(
    (childElement) => childElement.textContent?.trim() ?? "",
  );
}

function toMessageVerb(messageElement: Element): TwimlVerb {
  const bodyTexts = readChildText(messageElement, "Body");
  const mediaUrls = readChildText(messageElement, "Media");
  const hasChildren = bodyTexts.length > 0 || mediaUrls.length > 0;

  return {
    verb: "Message",
    body: hasChildren
      ? bodyTexts.join("\n")
      : (messageElement.textContent?.trim() ?? ""),
    to: messageElement.getAttribute("to"),
    from: messageElement.getAttribute("from"),
    status_callback: messageElement.getAttribute("statusCallback"),
    media_urls: mediaUrls,
  };
}

/**
 * The `<Message>` and `<Redirect>` verbs of a TwiML document, in order
 * (04-sms, reply webhook); anything that is not a `<Response>` document is
 * Twilio's 12100 Document parse failure.
 */
export function parseTwiml(twimlText: string): TwimlParseResult {
  const parsedDocument = new DOMParser().parseFromString(
    twimlText,
    "application/xml",
  );
  const rootElement = parsedDocument.documentElement;
  if (
    parsedDocument.getElementsByTagName("parsererror").length > 0 ||
    rootElement.nodeName !== "Response"
  ) {
    return { isValid: false, message: "Document parse failure" };
  }

  return {
    isValid: true,
    verbs: [...rootElement.children].flatMap((verbElement): TwimlVerb[] => {
      if (verbElement.nodeName === "Message") {
        return [toMessageVerb(verbElement)];
      }
      if (verbElement.nodeName === "Redirect") {
        return [
          { verb: "Redirect", url: verbElement.textContent?.trim() ?? "" },
        ];
      }
      return [];
    }),
  };
}
