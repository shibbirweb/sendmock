import type { DeeperEntry, DeeperPage } from "../deeper-types";

const verificationEntries: DeeperEntry[] = [
  {
    control: "heading: Verify",
    does: "Names the screen, in the header and above the tabs.",
  },
  {
    control: "link: Read the Verify guide",
    does: "Opens this screen's page in the user guide, in a new tab.",
    links: "[Verify](../../sms/verify.md).",
  },
  {
    control:
      "paragraph: Twilio Verify emulation: every code your app requests, its attempts and expiry, and controls to force any outcome.",
    does: "Explains the screen.",
  },
  {
    control: "tab: Verifications",
    does: "Every verification your app started, newest first.",
    operationIds: ["getVerify"],
  },
  {
    control: "tab: Services",
    does: "The Verify services apps start verifications against.",
    operationIds: ["getVerifyServices"],
  },
  { control: "button: All", does: "Shows every verification." },
  {
    control: "button: Pending",
    does: "Shows only verifications still waiting for a correct code.",
  },
  { control: "button: Approved", does: "Shows only approved verifications." },
  {
    control: "button: Failed",
    does: "Shows only verifications that expired, were cancelled or ran out of attempts.",
  },
  {
    control: "textbox: Search verifications",
    does: "Filters by phone number, email address or service.",
  },
  { control: "columnheader: To", does: "Who the code went to." },
  { control: "columnheader: Channel", does: "SMS, WhatsApp, email or call." },
  {
    control: "columnheader: Service",
    does: "The Verify service it belongs to.",
  },
  { control: "columnheader: Code", does: "The code that was sent." },
  {
    control: "columnheader: Status",
    does: "Pending, approved, canceled, expired or max attempts reached.",
  },
  {
    control: "columnheader: Attempts",
    does: "How many checks were made, against the service's limit.",
  },
  { control: "columnheader: Time", does: "When it was started." },
  {
    control: "each item, link: …",
    does: "Opens the verification's details.",
    operationIds: ["getVerifyByVerificationSid"],
  },
  {
    control: "each item, button: Copy code #",
    does: "Copies the code, to type it into your app.",
  },
  {
    control: "heading: Verification",
    does: "The details drawer of one verification.",
  },
  {
    control: "paragraph: Code, attempts and everything that happened to it.",
    does: "Explains the drawer: the code, each check with its result, and the timeline.",
  },
  { control: "button: Copy code", does: "Copies the code." },
  {
    control: "link: Open the message",
    does: "Opens the SMS or email the code was delivered in.",
    links: "[SMS](../../sms/index.md).",
  },
  {
    control: "heading: Force a state",
    does: "Moves the verification to a final state by hand, to test what your app does then.",
  },
  {
    control: "button: Approve",
    does: "Approves the verification, as a correct code would.",
    changes: "Fires `verify.checked` with the status `approved`.",
    operationIds: ["postVerifyByVerificationSidForce"],
  },
  {
    control: "button: Cancel",
    does: "In the drawer, cancels the verification (fires `verify.checked` with the status `canceled`); in a dialog, closes it without saving.",
    operationIds: ["postVerifyByVerificationSidForce"],
  },
  {
    control: "button: Expire",
    does: "Expires the verification, as when its time runs out.",
    changes: "Fires `verify.expired`.",
    operationIds: ["postVerifyByVerificationSidForce"],
  },
  {
    control: "button: Max attempts",
    does: "Ends the verification as if too many wrong codes were tried; checks then get Twilio's 60202 error.",
    changes: "Fires `verify.checked` with the status `max_attempts_reached`.",
    operationIds: ["postVerifyByVerificationSidForce"],
  },
  {
    control:
      "paragraph: Your app sees the new state on its next check or fetch.",
    does: "Explains when the forced state takes effect.",
  },
  { control: "button: Close", does: "Closes the drawer or dialog." },
];

const verifyServiceEntries: DeeperEntry[] = [
  {
    control:
      "paragraph: Code length, an optional fixed code and how long codes stay valid.",
    does: "Explains what a service sets.",
  },
  {
    control: "button: New service",
    does: "Opens the New Verify service dialog.",
  },
  { control: "columnheader: Name", does: "The service's friendly name." },
  {
    control: "columnheader: SID",
    does: "Its `VA...` SID, which apps put in the Verify API path.",
  },
  {
    control: "columnheader: Expires after",
    does: "How long a code stays valid.",
  },
  {
    control: "columnheader: Actions",
    does: "Edit and Delete for each service.",
  },
  {
    control: "each item, button: …",
    does: "Edit opens the service's settings; Delete removes it after you confirm.",
    operationIds: [
      "patchVerifyServicesByServiceSid",
      "deleteVerifyServicesByServiceSid",
    ],
  },
  {
    control: "heading: New Verify service",
    does: "The New Verify service dialog.",
  },
  {
    control:
      "paragraph: Apps start verifications against a service by its SID.",
    does: "Explains the SID.",
  },
  { control: "textbox: Name", does: "The service's friendly name." },
  {
    control: "combobox: Code length",
    does: "How many digits the codes have, 4 to 10.",
  },
  {
    control: "spinbutton: Expires after (minutes)",
    does: "How long a code stays valid.",
  },
  {
    control: "textbox: Fixed code (optional)",
    does: "A code every verification of this service uses, instead of a random one.",
  },
  {
    control:
      "paragraph: Leave empty for a random code. A fixed code makes tests deterministic.",
    does: "Explains the fixed code.",
  },
  {
    control: "button: Create service",
    does: "Creates the service with a new SID.",
    operationIds: ["postVerifyServices"],
  },
];

const verifyEmptyAndFailingEntries: DeeperEntry[] = [
  {
    control: "paragraph: No verifications yet",
    does: "Shown when no verification was started yet.",
  },
  {
    control:
      "paragraph: Start one from your app with the Twilio Verify API. The code shows up here and in the SMS screen.",
    does: "Explains how verifications arrive.",
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
    control: "button: Copy Twilio base URL",
    does: "Copies the base URL to give Twilio's SDK.",
  },
  {
    control: "button: Copy Start a verification",
    does: "Copies the Verify API URL that starts a verification.",
  },
  {
    control: "link: More snippets",
    does: "Opens Settings > Connection.",
    links: "[Settings](../../settings.md).",
  },
  {
    control: "button: Start a sample verification",
    does: "Starts a verification against the first service and delivers its code by SMS.",
    changes: "Fires `verify.started` and stores the SMS with the code.",
    operationIds: ["postSamplesByKind"],
  },
  {
    control: "alert: Could not load verifications. Try again",
    does: "Shown when the verifications could not be loaded.",
    errors: "Check SendMock is running, then press Try again.",
  },
  {
    control: "paragraph: Could not load verifications.",
    does: "The message inside the alert.",
  },
  {
    control: "button: Try again",
    does: "Loads the verifications again.",
    operationIds: ["getVerify"],
  },
];

/** SMS > Verify: verifications, a verification's details and the Verify services. */
export const smsVerifyPage: DeeperPage = {
  screen: "/sms/verify",
  file: "sms/verify.md",
  title: "Verify in depth",
  description:
    "Every control and text of SMS > Verify, a verification's details and the services.",
  guidePage: "sms/verify.md",
  guideTitle: "Verify",
  intro:
    "SMS > Verify shows every one-time code your app requested through the Twilio Verify API, and lets you force any outcome.",
  entries: [
    ...verificationEntries,
    ...verifyServiceEntries,
    ...verifyEmptyAndFailingEntries,
  ],
};
