import { describe, expect, test } from "vitest";

import { parseTwiml } from "@/mocks/sms-replies/parse-twiml";

describe("parseTwiml", () => {
  test("SM-09.7 reads Message verbs with their attributes, Body and Media, and Redirect with its method", () => {
    expect(
      parseTwiml(`<Response>
        <Message statusCallback="http://localhost:8000/sms/status" action="/sms/sent" method="get">Thanks!</Message>
        <Message to="+15005550006" from="+15550001111">
          <Body>Your ticket</Body>
          <Media>https://example.com/ticket.png</Media>
        </Message>
        <Redirect method="GET">http://localhost:8000/sms/next</Redirect>
        <Redirect>http://localhost:8000/sms/last</Redirect>
      </Response>`),
    ).toEqual({
      isValid: true,
      verbs: [
        {
          verb: "Message",
          body: "Thanks!",
          to: null,
          from: null,
          status_callback: "http://localhost:8000/sms/status",
          action: "/sms/sent",
          method: "GET",
          media_urls: [],
        },
        {
          verb: "Message",
          body: "Your ticket",
          to: "+15005550006",
          from: "+15550001111",
          status_callback: null,
          action: null,
          method: "POST",
          media_urls: ["https://example.com/ticket.png"],
        },
        {
          verb: "Redirect",
          url: "http://localhost:8000/sms/next",
          method: "GET",
        },
        {
          verb: "Redirect",
          url: "http://localhost:8000/sms/last",
          method: "POST",
        },
      ],
    });
  });

  test("SM-09.7 an empty Response has no verbs; other documents fail to parse", () => {
    expect(parseTwiml("<Response/>")).toEqual({ isValid: true, verbs: [] });
    expect(parseTwiml("<html><body>Hi</body></html>")).toEqual({
      isValid: false,
      message: "Document parse failure",
    });
    expect(parseTwiml("<Response><Message>")).toMatchObject({ isValid: false });
  });
});
