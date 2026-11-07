import type { DeeperEntry } from "../deeper-types";

/** Mail: an open email, its tabs and what a code email adds. */
export const mailInboxEmailEntries: DeeperEntry[] = [
  {
    control: "heading: Welcome to Acme: here is what is new this week",
    does: "The open email's subject (here the demo's newsletter).",
    source: "The email's `Subject` header.",
  },
  {
    control: "heading: Your verification code",
    does: "The open email's subject (here the demo's sign-up email).",
    source: "The email's `Subject` header.",
  },
  {
    control: "button: Reply",
    does: "Opens the composer to answer as the recipient: the reply arrives in SendMock as an incoming email to your app, as a real customer's reply would. Reply all appears beside it when the email had several recipients.",
    links: "[Replies and forwards](../../mail/replies-and-forwards.md).",
  },
  {
    control: "button: Forward",
    does: "Opens the composer to forward the email as the recipient, to an address your app receives on.",
  },
  {
    control: "button: Mark as unread",
    does: "Marks the open email unread again (Mark as read when it is unread). Opening an email marks it read.",
    changes: "The email's `is_read`; the sidebar's unread count follows.",
    operationIds: ["patchEmailsByEmailId"],
  },
  {
    control: "button: Delete email",
    does: "Deletes the open email at once and goes back to the list; a notice confirms it.",
    operationIds: ["deleteEmailsByEmailId"],
  },
  {
    control: "button: Simulate an event",
    does: "Opens a menu of outcomes to simulate for this email, as the provider would report them.",
  },
  {
    control: "button: More actions",
    does: "Opens a menu with Download .eml, Release to real SMTP and Send to webhook.",
  },
  {
    control: "link: SendGrid",
    does: "Says the email came through the SendGrid API, and opens Mail > Providers.",
    source:
      "The email's `source`: the provider key, or SMTP, sendmail, the native API, Verify or a simulated reply.",
    links: "[Mail > Providers](../../mail/providers.md).",
  },
  {
    control: "link: SMTP",
    does: "Says the email came over SMTP, and opens the SMTP session that delivered it in Logs.",
    links: "[Logs](../../logs.md).",
  },
  {
    control: "button: Edit tags",
    does: "Lets you add or remove the email's tags. Tags also come from plus addresses, headers and tag rules.",
    changes: "The email's `tags`.",
    operationIds: ["patchEmailsByEmailId"],
  },
  {
    control: "link: https://acme.test/blog",
    does: "A link found in the email, opened in a new tab. Verification and reset links are listed first.",
    source: "Extracted from the text and HTML bodies when the email is stored.",
    operationIds: ["getEmailsByEmailId"],
  },
  {
    control: "button: Copy link",
    does: "Copies the link beside it.",
  },
  {
    control: "button: Copy code #",
    does: "Copies the one-time code found in the email, here the sign-up code. Your tests read the same code with `GET /api/v1/otp`.",
    source:
      "The built-in code patterns, plus your own in Settings > OTP patterns.",
    links: "[Recipe: read a code](../../recipes/read-a-code.md).",
  },
  {
    control: "tab: HTML",
    does: "Shows the HTML body in a sandboxed frame: scripts never run and remote images stay blocked until you load them.",
  },
  {
    control: "tab: Text",
    does: "Shows the plain text body as it was sent.",
  },
  {
    control: "tab: Source",
    does: "Shows the whole raw message, headers and all, byte for byte as received.",
    operationIds: ["getEmailsByEmailIdRaw"],
  },
  {
    control: "tab: Headers",
    does: "Lists every header with its value, in the order received.",
  },
  {
    control: "tab: Attachments (#)",
    does: "Lists the attachments, with a preview for images, and the number of them in the tab's name.",
  },
  {
    control: "tab: MIME",
    does: "Shows the message's MIME tree: each part with its type, encoding and size.",
    operationIds: ["getEmailsByEmailIdMime"],
  },
  {
    control: "tab: Checks",
    does: "Runs the quality checks: HTML and CSS support across email clients, the links (when you ask) and a spam score.",
  },
  {
    control: "tab: Timeline",
    does: "Lists what happened to the email: received, then each delivery outcome, open and reply, with the webhook deliveries they caused.",
    operationIds: ["getEmailsByEmailIdTimeline"],
  },
  {
    control: "tab: Template data",
    does: "For an email sent with a provider's dynamic template, shows the template id and the data your app sent with it.",
  },
  {
    control: "radio: Desktop width",
    does: "Shows the HTML at a desktop width.",
  },
  {
    control: "radio: Tablet width",
    does: "Shows the HTML at a tablet width.",
  },
  {
    control: "radio: Mobile width",
    does: "Shows the HTML at a phone width, to check the layout responds.",
  },
  {
    control: "button: Load remote images",
    does: "Loads the images the HTML fetches from the internet, which are blocked by default so opening an email sends no request to a tracker.",
  },
  {
    control: "button: Screenshot",
    does: "Saves the HTML preview, at the chosen width, as a PNG file.",
  },
  {
    control: "img: hero.png",
    does: "A preview of an image attachment.",
    operationIds: ["getEmailsByEmailIdPartsByAttachmentIndexThumbnail"],
  },
  {
    control: "link: Download hero.png",
    does: "Downloads the attachment.",
    operationIds: ["getEmailsByEmailIdAttachmentsByAttachmentIndex"],
  },
  {
    control: "each item, link: Download part …",
    does: "Downloads one part of the MIME tree as it was encoded in the message.",
    operationIds: ["getEmailsByEmailIdMimeByPartId"],
  },
  {
    control: "heading: HTML compatibility: #%",
    does: "How much of the email's HTML and CSS is supported across the common email clients, with each finding below it.",
    source: "Can I Email's support data, built into SendMock.",
    operationIds: ["getEmailsByEmailIdHtmlCheck"],
  },
  {
    control:
      "paragraph: CSS background (line #): Partly supported in Outlook for Windows (#%).",
    does: "A finding: a feature the HTML uses, the line it is on, and the clients that do not fully support it.",
  },
  {
    control:
      "paragraph: Inline CID images (line #): Partly supported in Outlook for Windows (#%).",
    does: "A finding about images embedded in the message by `cid:` references.",
  },
  {
    control:
      "paragraph: Remote images (line #): Partly supported in Outlook for Windows (#%).",
    does: "A finding about images loaded from the internet.",
  },
  {
    control: "heading: Links and images",
    does: "The link check: each link and image with the status it answered, and redirects followed.",
  },
  {
    control: "button: Check links",
    does: "Requests every link and image in the email and shows what each answered; Check again repeats it.",
    errors:
      "A link that times out or answers 4xx or 5xx is marked broken; links to `localhost` work only if your app is running.",
    operationIds: ["postEmailsByEmailIdLinkCheck"],
  },
  {
    control:
      "paragraph: Runs only when you ask, because it makes real requests to every link.",
    does: "Explains why the link check does not run by itself.",
  },
  {
    control: "heading: Spam score: #.# / #",
    does: "The email's spam score against the threshold, with the rules that matched, from the SpamAssassin you run and point SendMock at with `--spamassassin`.",
    errors:
      "Without `--spamassassin`, or when spamd does not answer, the check says it is not available.",
    operationIds: ["postEmailsByEmailIdSpamCheck"],
  },
  {
    control:
      "paragraph: Sent with provider template d-#f#c#b#a#e#d . The template content lives at the provider, so only the data is shown.",
    does: "Names the provider's template id; the template itself lives at the provider, so only the data your app sent is shown.",
  },
];
