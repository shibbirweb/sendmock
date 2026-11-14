/** Reference rows shown in Settings; the source of truth is docs/plan 03 and 04. */
export type MagicReferenceRow = {
  trigger: string;
  outcome: string;
  code: string | null;
};

export const emailMagicAddresses: MagicReferenceRow[] = [
  {
    trigger: "success@simulator.amazonses.com, delivered@<any>",
    outcome: "email.delivered",
    code: null,
  },
  {
    trigger: "bounce@simulator.amazonses.com, bounce@<any>, bounce+hard@<any>",
    outcome: "Hard bounce",
    code: "550 5.1.1",
  },
  {
    trigger: "bounce+soft@<any>",
    outcome: "email.deferred, then soft bounce",
    code: null,
  },
  {
    trigger: "complaint@simulator.amazonses.com, complaint@<any>",
    outcome: "Delivered, then email.complained",
    code: null,
  },
  {
    trigger: "ooto@simulator.amazonses.com",
    outcome: "Delivered, then an out-of-office reply",
    code: null,
  },
  {
    trigger: "suppressionlist@simulator.amazonses.com",
    outcome: "Bounce with a suppression-list reason",
    code: null,
  },
];

export const twilioToNumbers: MagicReferenceRow[] = [
  { trigger: "+15005550001", outcome: "Invalid number", code: "21211" },
  {
    trigger: "+15005550002",
    outcome: "Cannot route to this number",
    code: "21612",
  },
  {
    trigger: "+15005550003",
    outcome: "No international permissions",
    code: "21408",
  },
  {
    trigger: "+15005550004",
    outcome: "Number is blocked (opted out)",
    code: "21610",
  },
  {
    trigger: "+15005550009",
    outcome: "Number cannot receive SMS",
    code: "21614",
  },
];

export const twilioFromNumbers: MagicReferenceRow[] = [
  { trigger: "+15005550001", outcome: "Invalid From", code: "21212" },
  { trigger: "+15005550006", outcome: "Valid, passes", code: null },
  {
    trigger: "+15005550007",
    outcome: "Not owned or not SMS-capable",
    code: "21606",
  },
  { trigger: "+15005550008", outcome: "Message queue full", code: "21611" },
];

export const sendmockAfterSendNumbers: MagicReferenceRow[] = [
  {
    trigger: "+15005550101",
    outcome: "Accepted, then undelivered (unreachable handset)",
    code: "30003",
  },
  {
    trigger: "+15005550102",
    outcome: "Accepted, then undelivered (landline or unreachable carrier)",
    code: "30006",
  },
  {
    trigger: "+15005550103",
    outcome: "Accepted, then undelivered (filtered by carrier)",
    code: "30007",
  },
  {
    trigger: "+15005550104",
    outcome: "Accepted, then failed (unknown error)",
    code: "30008",
  },
  {
    trigger: "+15005550105",
    outcome: "Accepted, delivered after 30 s",
    code: null,
  },
  {
    trigger: "+15005550106",
    outcome: "Accepted, delivered, then read",
    code: null,
  },
];
