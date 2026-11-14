import type { DeeperEntry } from "../deeper-types";
import { describeChooseWebhooks } from "./webhook-target-entries";

/** Mail: the list, its filters, selection, the empty and failing states, and the list dialogs. */
export const mailInboxListEntries: DeeperEntry[] = [
  {
    control: "heading: Mail",
    does: "Names the open screen in the header.",
  },
  {
    control: "link: Read the Mail guide",
    does: "Opens this screen's page in the user guide, in a new tab.",
    links: "[Inbox](../../mail/index.md).",
  },
  {
    control: "textbox: Search emails",
    does: "Filters the list as you type. Free text is a full-text search of the emails; `from:`, `to:`, `tag:`, `source:`, `is:unread`, `is:inbound`, `is:outbound` and `has:attachment` narrow it further, and each one shows as a chip you can remove.",
    source:
      "The filters are sent to the API, so the list, the count and Delete all emails all follow them.",
    operationIds: ["getEmails"],
  },
  {
    control: "button: Unread",
    does: "Shows only unread emails; press it again to show all. The same as `is:unread`.",
    operationIds: ["getEmails"],
  },
  {
    control: "button: Attachments",
    does: "Shows only emails with an attachment. The same as `has:attachment`.",
    operationIds: ["getEmails"],
  },
  {
    control: "button: Inbound",
    does: "Shows only incoming emails: replies and mail sent to an inbound domain, as opposed to mail your app sent. The same as `is:inbound`.",
    operationIds: ["getEmails"],
  },
  {
    control: "button: SendGrid",
    does: "Shows only the emails that arrived through the SendGrid API. A quick filter appears for each email provider and transport the stored mail came through. The same as `source:sendgrid`.",
    source: "The sources of the emails stored now.",
    operationIds: ["getEmails"],
  },
  {
    control: "button: SMTP",
    does: "Shows only the emails that arrived over SMTP. The same as `source:smtp`.",
    operationIds: ["getEmails"],
  },
  {
    control: "checkbox: Select all loaded emails",
    does: "Selects every email loaded in the list, or clears the selection. Selected emails can be marked read or deleted together.",
  },
  {
    control: "button: Notify me about new emails",
    does: "Asks the browser for permission, then shows a system notification for each new email that matches the current filter, while this tab is open.",
    errors:
      "If the browser blocks notifications, allow them for this site in the browser's settings and press the button again.",
  },
  {
    control: "button: Import .eml",
    does: "Opens the Import .eml dialog, to store a whole message from a file or pasted text.",
  },
  {
    control: "button: Delete all emails",
    does: "Asks for confirmation, then deletes every email, or only the ones the current search and filters show.",
    changes:
      "Deletes the emails and their attachments; webhook deliveries and logs are kept.",
    operationIds: ["deleteEmails"],
  },
  {
    control: "each item, checkbox: Select email from …",
    does: "Selects this email for Mark read or Delete.",
  },
  {
    control: "each item, img: Unread",
    does: "Marks an email you have not opened yet. Opening it marks it read.",
    source: "The email's `is_read` field.",
  },
  {
    control: "each item, img: Has attachments",
    does: "Marks an email with at least one attachment.",
  },
  {
    control: "each item, img: …",
    does: "Other markers a row can show, such as Has a code when a one-time code was found in the email.",
  },
  {
    control: "each item, link: …",
    does: "Opens the email beside the list: the sender, the time it arrived, the subject, the first words of the body, and its source and delivery outcome badges. `J` and `K` open the next and previous email.",
    operationIds: ["getEmailsByEmailId"],
  },
  {
    control:
      "paragraph: Select an email to read it. Use J and K to move through the list.",
    does: "Shown in the reading pane until an email is open.",
  },
  {
    control: "button: Mark read",
    does: "Marks every selected email as read.",
    operationIds: ["patchEmailsByEmailId"],
  },
  {
    control: "button: Delete",
    does: "Deletes every selected email at once, without asking, and says how many were deleted.",
    operationIds: ["deleteEmailsByEmailId"],
  },
  {
    control: "paragraph: No emails yet",
    does: "Shown when there is no email at all, with how to connect your app.",
  },
  {
    control:
      "paragraph: Point your app's SMTP settings at SendMock and send something. No auth or TLS needed.",
    does: "Explains the first step: SendMock accepts any SMTP login, so only the host and port matter.",
  },
  {
    control: "radio: This machine",
    does: "Shows the addresses for an app running on the same machine as SendMock (`127.0.0.1`).",
    changes:
      "The choice is shared with Settings > Connection and remembered in the browser.",
    source: "The ports come from `GET /api/v1/info`.",
    operationIds: ["getInfo"],
  },
  {
    control: "radio: Docker host",
    does: "Shows the addresses for an app in a container reaching SendMock on the host (`host.docker.internal`).",
  },
  {
    control: "radio: Compose",
    does: "Shows the addresses for an app in the same Docker Compose project (the `sendmock` service name).",
  },
  {
    control: "button: Copy SMTP host",
    does: "Copies the SMTP host for the chosen location.",
  },
  {
    control: "button: Copy SMTP port",
    does: "Copies the SMTP port the running SendMock listens on.",
  },
  {
    control: "link: More snippets",
    does: "Opens Settings > Connection, with the settings for every language and framework.",
    links: "[Settings](../../settings.md).",
  },
  {
    control: "button: Send a sample email",
    does: "Stores a realistic sample email, so you can try the screen before connecting your app.",
    changes:
      "Stores an email and fires `email.received`, which your webhook rules can deliver.",
    operationIds: ["postSamplesByKind"],
  },
  describeChooseWebhooks(
    "button: Choose webhooks for Send a sample email",
    "postSamplesByKind",
  ),
  {
    control: "alert: Could not load emails. Try again",
    does: "Shown when the list could not be loaded, for example because SendMock stopped.",
    errors:
      "Check SendMock is running (the status at the bottom of the sidebar), then press Try again.",
  },
  {
    control: "paragraph: Could not load emails.",
    does: "The message inside the alert.",
  },
  {
    control: "button: Try again",
    does: "Loads the list again.",
    operationIds: ["getEmails"],
  },
  {
    control: "heading: Import .eml",
    does: "The Import .eml dialog: stores a whole message, headers and all.",
  },
  {
    control:
      "paragraph: Store a whole message, headers and all, from a file or pasted text.",
    does: "Explains what the dialog does.",
  },
  {
    control:
      "radio: Sent by your app As if your app sent it, like the sendmail shim (POST /send/raw).",
    does: "Stores the message as mail your app sent, exactly as the sendmail shim would.",
    changes: "Fires `email.received`.",
    operationIds: ["postSendRaw"],
  },
  {
    control:
      "radio: Incoming to your app As a reply or new mail to your app; inbound routes deliver it.",
    does: "Stores the message as incoming mail, which inbound routes then deliver to your app.",
    changes: "Fires `email.inbound` and runs the inbound routes.",
    operationIds: ["postEmailsInbound"],
  },
  {
    control: "textbox: Message",
    does: "The raw message to store, or (in a composer) the body of the reply or forward.",
  },
  {
    control: "button: Upload a .eml file",
    does: "Reads a `.eml` file from your computer into the Message field.",
  },
  {
    control: "button: Import",
    does: "Stores the message; a notice says it was imported, with Open to read it.",
    errors:
      "A message that cannot be parsed is refused with the reason; fix the headers and try again.",
  },
  {
    control: "button: Close",
    does: "Closes the dialog without doing anything.",
  },
  {
    control: "heading: Delete all emails?",
    does: "The confirmation before deleting every email (or every email the filter shows).",
  },
  {
    control:
      "paragraph: This removes all # captured emails. It cannot be undone.",
    does: "Says how many emails will be deleted.",
  },
  {
    control: "button: Cancel",
    does: "Closes the dialog or composer without doing anything.",
  },
  {
    control: "button: Delete all",
    does: "Deletes the emails.",
    operationIds: ["deleteEmails"],
  },
];
