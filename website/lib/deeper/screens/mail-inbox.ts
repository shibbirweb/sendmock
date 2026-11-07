import type { DeeperPage } from "../deeper-types";
import { mailInboxActionEntries } from "./mail-inbox-actions";
import { mailInboxEmailEntries } from "./mail-inbox-email";
import { mailInboxListEntries } from "./mail-inbox-list";

/** Mail > Inbox: the list, an open email, and everything they open. */
export const mailInboxPage: DeeperPage = {
  screen: "/mail",
  file: "mail/inbox.md",
  title: "Inbox in depth",
  description:
    "Every control and text of Mail > Inbox, an open email and its dialogs.",
  guidePage: "mail/index.md",
  guideTitle: "Inbox",
  intro:
    "Mail > Inbox lists every email SendMock caught, whatever the recipient, and shows the one you open beside the list.",
  entries: [
    ...mailInboxListEntries,
    ...mailInboxEmailEntries,
    ...mailInboxActionEntries,
  ],
};
