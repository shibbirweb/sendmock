import type { DeeperEntry } from "../deeper-types";

/** How the provider editor names a message and its operations, per menu. */
export type ProviderEditorArea = {
  messageWord: "email" | "SMS";
  /** `Emails` or `Sms`, as in `patchEmailsProvidersByProviderKey`. */
  operationArea: "Emails" | "Sms";
};

/** The provider editor's General and Requests tabs, shared by Mail > Providers and SMS > Providers. */
export function buildProviderEditorSetupEntries({
  messageWord,
  operationArea,
}: ProviderEditorArea): DeeperEntry[] {
  return [
    {
      control: "tab: General",
      does: "Name, key, host, badge colour, whether it is on, and its credentials.",
    },
    {
      control: "tab: Requests",
      does: `The API paths it answers, how each request's fields map to a stored ${messageWord}, and the checks a request must pass.`,
    },
    {
      control: "tab: Responses",
      does: "What it answers: the message id format, the success response and each error response, as templates.",
    },
    {
      control: "tab: Callbacks",
      does: "The webhook template its status callbacks are sent with, and its own names for each status.",
    },
    {
      control: "tab: Preview",
      does: "Sends a sample request through the unsaved definition and shows the stored message and the response.",
    },
    {
      control: "tab: Try it",
      does: "The base URLs and a curl command to point your app or the provider's SDK at it.",
    },
    {
      control: "textbox: Name",
      does: "The name shown in lists and on message badges.",
    },
    {
      control: "textbox: Key",
      does: "The short id in its paths (`/providers/<key>/`) and stored on each message as its source. It cannot change once added.",
    },
    {
      control:
        "paragraph: Its /providers/<key>/ path and the name stored on messages; fixed once added.",
      does: "Explains the key.",
    },
    {
      control: "textbox: Host",
      does: "The provider's real API host, such as `api.sendgrid.com`.",
    },
    {
      control:
        "paragraph: The provider's API host. On the provider port it tells apart providers that share a path.",
      does: "Explains why the host matters: on the provider port, requests are matched by host when two providers use the same path.",
    },
    {
      control: "textbox: Accent colour",
      does: "Picks the badge colour with the browser's colour picker.",
    },
    {
      control: "textbox: Accent",
      does: "The badge colour as a hex value, such as `#1a82e2`.",
    },
    {
      control: "paragraph: The colour of its badge on messages.",
      does: "Explains the accent.",
    },
    {
      control: "switch: Enabled",
      does: "Turns the provider on or off; while off, its paths answer 404.",
    },
    {
      control:
        "paragraph: What your app is configured with. Templates read them as credentials.<name> ; secrets stay masked, in the preview too.",
      does: "Explains the credentials: the API key and other values your app sends, which templates can read.",
    },
    {
      control: "textbox: Credential # name",
      does: "A credential's name, such as `api_key`.",
    },
    {
      control: "textbox: Credential # value",
      does: "The credential's value; a secret one is masked.",
    },
    {
      control: "checkbox: Secret",
      does: "Masks the value everywhere: the UI, API answers, logs, MCP results and seed exports.",
    },
    {
      control: "button: Remove credential #",
      does: "Removes the credential.",
    },
    {
      control: "button: Add credential",
      does: "Adds a credential row.",
    },
    {
      control: "switch: Check credentials",
      does: "When on, a request without the right secret credential gets the provider's own unauthorized answer.",
    },
    {
      control:
        "paragraph: Off: any credentials pass. On: a request without a secret credential gets the provider's unauthorized answer.",
      does: "Explains Check credentials.",
    },
    {
      control: "button: Save provider",
      does: "Saves the definition; it applies to the next request, with no restart.",
      errors:
        "A template that does not render, or a path another provider already answers, is refused with the reason.",
      operationIds: [`patch${operationArea}ProvidersByProviderKey`],
    },
    {
      control:
        "paragraph: The paths as the provider's API has them; use {name} for a part that changes, like /v#/{domain}/messages .",
      does: "Explains request paths and their `{name}` parts.",
    },
    {
      control: "combobox: Request # kind",
      does: `What the request does: send one ${messageWord}, send a batch, or another operation the provider has.`,
    },
    {
      control: "combobox: Request # method",
      does: "The HTTP method it answers.",
    },
    {
      control: "textbox: Request # path",
      does: "The path it answers.",
    },
    {
      control: "combobox: Request # format",
      does: "The body format the provider's SDK sends: JSON, a form or multipart.",
    },
    {
      control: "button: Remove request #",
      does: "Removes the request.",
    },
    {
      control: "button: Add request",
      does: "Adds a request the provider answers.",
    },
    {
      control:
        "paragraph: A JSON path ( personalizations[*].to[*].email ), a form field ( To ) or h:* for every field with a prefix. Anything unmapped is kept as metadata.",
      does: "Explains the field mapping sources.",
    },
    {
      control: "combobox: Mapping # part",
      does: `Which part of the stored ${messageWord} the field fills, such as the recipients or the subject.`,
    },
    {
      control: "textbox: Mapping # source",
      does: "Where in the request that part is read from.",
    },
    {
      control: "button: Remove mapping #",
      does: "Removes the mapping.",
    },
    {
      control: "button: Map a part",
      does: "Adds a mapping.",
    },
    {
      control: "combobox: Check # part",
      does: "The part a request check looks at.",
    },
    {
      control: "combobox: Check # kind",
      does: "What the check requires, such as present or at most a length.",
    },
    {
      control: "spinbutton: Check # max length",
      does: "The longest value the check allows.",
    },
    {
      control: "combobox: Check # error",
      does: "Which error response a request failing the check gets.",
    },
    {
      control: "button: Remove check #",
      does: "Removes the check.",
    },
    {
      control: "button: Add check",
      does: "Adds a check.",
    },
  ];
}
