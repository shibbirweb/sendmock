import type { DeeperEntry, DeeperPage } from "../deeper-types";
import { smsMessageDetailEntries } from "./sms-message-details";

const smsListEntries: DeeperEntry[] = [
  { control: "heading: SMS", does: "Names the open screen in the header." },
  {
    control: "link: Read the SMS guide",
    does: "Opens this screen's page in the user guide, in a new tab.",
    links: "[SMS](../../sms/index.md).",
  },
  {
    control: "textbox: Search conversations",
    does: "Filters the conversations by phone number or message text as you type.",
    operationIds: ["getSmsThreads"],
  },
  { control: "button: All", does: "Shows every conversation." },
  { control: "button: SMS", does: "Shows only SMS and MMS conversations." },
  {
    control: "button: WhatsApp",
    does: "Shows only WhatsApp conversations (messages sent with `whatsapp:` addresses).",
  },
  {
    control: "each item, link: +# …",
    does: "Opens the conversation with that number: the other side's number, the last message and when it was sent. `J` and `K` open the next and previous one.",
    operationIds: ["getSmsThreads"],
  },
  {
    control: "each item, img: Delivered",
    does: "The last message's status as ticks: sent, delivered or read; a red mark for undelivered or failed.",
    source:
      "The message's status, moved on by the delivery simulation or Set status.",
  },
  {
    control: "each item, img: …",
    does: "Other markers a conversation can show, such as an unread inbound message or media.",
  },
  {
    control:
      "paragraph: Select a conversation to read it. Use J and K to move through the list.",
    does: "Shown until a conversation is open.",
  },
  {
    control: "paragraph: No SMS yet",
    does: "Shown when there is no SMS at all, with how to connect your app.",
  },
  {
    control:
      "paragraph: Send through the SendMock API, or point your Twilio or Vonage SDK at SendMock.",
    does: "Explains the ways in: the native API, or a provider SDK with its base URL changed.",
  },
  {
    control: "radio: This machine",
    does: "Shows the addresses for an app on the same machine.",
    changes: "Shared with Settings > Connection and remembered in the browser.",
    operationIds: ["getInfo"],
  },
  {
    control: "radio: Docker host",
    does: "Shows the addresses for an app in a container reaching SendMock on the host.",
  },
  {
    control: "radio: Compose",
    does: "Shows the addresses for an app in the same Docker Compose project.",
  },
  {
    control: "button: Copy Native API",
    does: "Copies the native send URL, `POST /api/v1/sms`.",
  },
  {
    control: "button: Copy Twilio base URL",
    does: "Copies the base URL to give Twilio's SDK.",
  },
  {
    control: "button: Copy Vonage base URL",
    does: "Copies the base URL to give Vonage's SDK.",
  },
  {
    control: "link: More snippets",
    does: "Opens Settings > Connection, with the settings for every language.",
    links: "[Settings](../../settings.md).",
  },
  {
    control: "button: Send a sample SMS",
    does: "Stores a realistic sample SMS, so you can try the screen before connecting your app.",
    changes: "Fires `sms.sent` and starts the delivery simulation.",
    operationIds: ["postSamplesByKind"],
  },
  {
    control: "alert: Could not load conversations. Try again",
    does: "Shown when the conversations could not be loaded.",
    errors: "Check SendMock is running, then press Try again.",
  },
  {
    control: "paragraph: Could not load conversations.",
    does: "The message inside the alert.",
  },
  {
    control: "button: Try again",
    does: "Loads the conversations again.",
    operationIds: ["getSmsThreads"],
  },
];

const smsConversationEntries: DeeperEntry[] = [
  {
    control: "heading: +#",
    does: "The other side's phone number.",
  },
  { control: "button: Copy phone number", does: "Copies that number." },
  {
    control: "paragraph: with +#, # message",
    does: "Your app's number in the conversation and how many messages it holds.",
  },
  {
    control: "heading: Today",
    does: "A day separator; messages are grouped by the day they were sent.",
  },
  {
    control: "link: #:#",
    does: "The time a message was sent; opens its Message details.",
  },
  {
    control: "img: Undelivered: # Unreachable destination handset",
    does: "The message's status, with the error code and its meaning when it was undelivered or failed (here Twilio's 30003).",
    source:
      "A magic number, your outcome rules, the delivery profile or Set status.",
    links: "[Magic numbers and addresses](../../reference/magic-numbers.md).",
  },
  {
    control: "button: Message actions",
    does: "Opens the message's menu: details, Simulate read, Send to webhook, copy and delete.",
  },
  {
    control: "button: Attach files",
    does: "Adds images or files to the reply, which then arrives as an MMS with `NumMedia` and `MediaUrl0` in the reply webhook.",
  },
  {
    control: "textbox: Reply as +#",
    does: "The text of a reply from the other side's phone. `Enter` sends, `Shift`+`Enter` adds a line.",
  },
  {
    control: "button: Send reply",
    does: "Stores the reply as an inbound message, as if the person had answered from their phone.",
    changes:
      "Fires `sms.inbound` and calls your app's reply webhook (the number's or Messaging Service's URL), reading its TwiML answer.",
    links: "[Replies and WhatsApp](../../sms/replies-and-whatsapp.md).",
    operationIds: ["postSmsInbound"],
  },
  {
    control:
      "paragraph: Simulates an inbound message from +#. # / #, # segment, GSM-#. Enter sends, Shift+Enter adds a line.",
    does: "Says who the reply comes from, the characters used out of the segment's limit, the segment count and the encoding (GSM-7 or UCS-2).",
  },
];

/** SMS > Messages: the conversations, an open conversation and its message details. */
export const smsMessagesPage: DeeperPage = {
  screen: "/sms",
  file: "sms/messages.md",
  title: "SMS messages in depth",
  description:
    "Every control and text of SMS > Messages, a conversation and a message's details.",
  guidePage: "sms/index.md",
  guideTitle: "SMS",
  intro:
    "SMS > Messages groups every SMS, MMS and WhatsApp message into conversations by phone number, and simulates the other side's replies.",
  entries: [
    ...smsListEntries,
    ...smsConversationEntries,
    ...smsMessageDetailEntries,
  ],
};
