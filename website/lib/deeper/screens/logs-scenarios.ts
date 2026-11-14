import type { DeeperEntry, DeeperPage } from "../deeper-types";
import { describeChooseWebhooks } from "./webhook-target-entries";

const logEntries: DeeperEntry[] = [
  { control: "heading: Logs", does: "Names the screen, in the header and above the tabs." },
  {
    control: "link: Read the Logs guide",
    does: "Opens this screen's page in the user guide, in a new tab.",
    links: "[Logs](../../logs.md).",
  },
  {
    control: "paragraph: Every SMTP session and API request, including the ones that failed, so you can see why a client was rejected.",
    does: "Explains the screen.",
  },
  { control: "tab: SMTP sessions", does: "Every SMTP connection, newest first.", operationIds: ["getLogsSmtp"] },
  { control: "tab: API requests", does: "Every request to the native and provider APIs, rejected ones included.", operationIds: ["getLogsHttp"] },
  { control: "button: All", does: "Shows every session." },
  { control: "button: Delivered", does: "Shows sessions that stored at least one email." },
  { control: "button: Failed", does: "Shows sessions that ended with an error, such as a refused login or a message too large." },
  { control: "textbox: Search SMTP sessions", does: "Filters by client, address or reply." },
  { control: "columnheader: Time", does: "When the session started." },
  { control: "columnheader: Client", does: "The client's address and its `EHLO` name." },
  { control: "columnheader: TLS", does: "Whether it used STARTTLS or implicit TLS." },
  { control: "columnheader: AUTH", does: "The login it used, if any." },
  { control: "columnheader: Result", does: "How it ended: delivered, or the error code and reply." },
  { control: "columnheader: Emails", does: "How many emails it stored." },
  { control: "columnheader: Duration", does: "How long it lasted." },
  { control: "each item, link: …", does: "Opens the session's transcript.", operationIds: ["getLogsSmtpBySessionId"] },
  { control: "heading: SMTP session", does: "The session drawer." },
  { control: "paragraph: Every command your app sent and every reply SendMock gave.", does: "Explains the drawer." },
  { control: "heading: Transcript", does: "The conversation, line by line." },
  { control: "link: Open email", does: "Opens the email the session delivered.", links: "[Inbox](../../mail/index.md)." },
  { control: "button: Copy transcript", does: "Copies the whole transcript." },
  { control: "each item, link: [message # bytes, stored as email]", does: "Where the message was sent in the transcript; opens the email it became." },
  {
    control: "paragraph: AUTH secrets are masked, and the message content is not repeated here: it is stored as the email.",
    does: "Explains what the transcript leaves out.",
  },
  { control: "button: Close", does: "Closes the drawer." },
  { control: "button: #xx", does: "Shows only rejected requests (4xx answers)." },
  { control: "combobox: Filter by API", does: "Shows one API's requests, such as Twilio or SendGrid, or all." },
  { control: "textbox: Search request paths", does: "Filters by path." },
  { control: "columnheader: API", does: "The API the request was for." },
  { control: "columnheader: Request", does: "Its method and path." },
  { control: "columnheader: Status", does: "The status SendMock answered." },
  { control: "each item, link: POST …", does: "Opens the request.", operationIds: ["getLogsHttpByRequestId"] },
  { control: "heading: API request", does: "The request drawer." },
  { control: "paragraph: Exactly what your app sent and what SendMock answered.", does: "Explains the drawer." },
  { control: "paragraph: POST /#-#-#/Accounts/AC#/Messages.json", does: "The request's method and path (here a Twilio send)." },
  { control: "link: Open SMS", does: "Opens the SMS the request created.", links: "[SMS](../../sms/index.md)." },
  { control: "heading: Request headers", does: "The headers received." },
  { control: "heading: Request body", does: "The body received." },
  { control: "button: Copy request body", does: "Copies the request body." },
  { control: "heading: Response body", does: "What SendMock answered, exactly." },
  { control: "button: Copy response body", does: "Copies the response body." },
  { control: "paragraph: Credentials such as API keys and passwords are masked before logging.", does: "Explains the masking." },
  { control: "paragraph: No SMTP sessions yet", does: "Shown while no app has connected over SMTP." },
  {
    control: "paragraph: Point your app's SMTP settings at SendMock; every connection shows up here, even the ones that fail.",
    does: "Explains how sessions arrive.",
  },
  { control: "radio: This machine", does: "Shows the addresses for an app on the same machine.", changes: "Shared with Settings > Connection and remembered in the browser.", operationIds: ["getInfo"] },
  { control: "radio: Docker host", does: "Shows the addresses for an app in a container reaching SendMock on the host." },
  { control: "radio: Compose", does: "Shows the addresses for an app in the same Docker Compose project." },
  { control: "button: Copy SMTP host", does: "Copies the SMTP host." },
  { control: "button: Copy SMTP port", does: "Copies the SMTP port." },
  { control: "link: More snippets", does: "Opens Settings > Connection.", links: "[Settings](../../settings.md)." },
  { control: "button: Send a sample email", does: "Stores a sample email.", operationIds: ["postSamplesByKind"] },
  describeChooseWebhooks("button: Choose webhooks for Send a sample email", "postSamplesByKind"),
  {
    control: "alert: Could not load the SMTP log. Try again",
    does: "Shown when the log could not be loaded.",
    errors: "Check SendMock is running, then press Try again.",
  },
  { control: "paragraph: Could not load the SMTP log.", does: "The message inside the alert." },
  { control: "button: Try again", does: "Loads the log again.", operationIds: ["getLogsSmtp"] },
];

const scenarioEntries: DeeperEntry[] = [
  { control: "heading: Scenarios", does: "Names the screen, in the header and above the editor." },
  {
    control: "link: Read the Scenarios guide",
    does: "Opens this screen's page in the user guide, in a new tab.",
    links: "[Scenarios](../../scenarios.md).",
  },
  {
    control:
      "paragraph: A test written once and run again: each step calls an operation, waits for a message, or checks a value. The same file runs with sendmock scenario run and in CI.",
    does: "Explains scenarios.",
    links: "[Advanced: scenarios](../../advanced/scenarios.md).",
  },
  { control: "button: Load example", does: "Puts an example scenario in the editor." },
  { control: "button: Upload", does: "Reads a scenario file from your computer." },
  { control: "link: Download", does: "Saves the scenario in the editor as a file." },
  { control: "textbox: Scenario", does: "The scenario, in YAML or JSON." },
  {
    control: "button: Validate",
    does: "Checks the scenario without running it and lists any errors.",
    operationIds: ["postScenariosValidate"],
  },
  {
    control: "button: Run",
    does: "Runs the steps in order and shows each one's result; the first failed check stops it.",
    changes: "The steps' own effects: sends, waits and checks against this SendMock.",
    operationIds: ["postScenariosRun"],
  },
  { control: "status: Passed: # of # steps in # ms", does: "The run's result: how many steps passed, and how long it took." },
];

/** Logs: SMTP sessions and API requests. */
export const logsPage: DeeperPage = {
  screen: "/logs",
  file: "logs.md",
  title: "Logs in depth",
  description: "Every control and text of Logs, an SMTP session and an API request.",
  guidePage: "logs.md",
  guideTitle: "Logs",
  intro: "Logs keeps every SMTP session and every API request, failed ones included, to see why a client was refused.",
  entries: logEntries,
};

/** Scenarios: multi-step checks. */
export const scenariosPage: DeeperPage = {
  screen: "/scenarios",
  file: "scenarios.md",
  title: "Scenarios in depth",
  description: "Every control and text of Scenarios.",
  guidePage: "scenarios.md",
  guideTitle: "Scenarios",
  intro: "Scenarios writes, validates and runs a multi-step check against this SendMock.",
  entries: scenarioEntries,
};
