import type { DeeperEntry } from "../deeper-types";
import type { ProviderEditorArea } from "./provider-editor-entries";

/** The provider editor's Responses, Callbacks, Preview and Try it tabs. */
export function buildProviderEditorResponseEntries({
  messageWord,
  operationArea,
}: ProviderEditorArea): DeeperEntry[] {
  return [
    {
      control:
        "paragraph: Templates read request , message , error and credentials ; the Preview tab lists every value with an example.",
      does: "Explains what response templates can read.",
    },
    {
      control: "textbox: Message id",
      does: "The template for the provider's id of each message.",
    },
    {
      control:
        "paragraph: The provider's id for each message, e.g. SM{{ random_hex(#) }}.",
      does: "Gives an example message id template.",
    },
    {
      control: "heading: Success response",
      does: "The answer to an accepted request.",
    },
    {
      control: "spinbutton: Success response status",
      does: "Its HTTP status.",
    },
    {
      control: "textbox: Success response header # name",
      does: "A response header's name.",
    },
    {
      control: "textbox: Success response header # value",
      does: "That header's value template.",
    },
    {
      control: "button: Remove Success response header #",
      does: "Removes the header.",
    },
    {
      control: "button: Add header",
      does: "Adds a response header.",
    },
    {
      control: "textbox: Success response body",
      does: "The body template.",
    },
    {
      control: "combobox: Error response # kind",
      does: "The error it answers: invalid input, unauthorized, a failed check, and so on.",
    },
    {
      control: "button: Remove error response #",
      does: "Removes the error response.",
    },
    {
      control: "spinbutton: Error response # status",
      does: "Its HTTP status.",
    },
    {
      control: "textbox: Error response # header # name",
      does: "A header's name.",
    },
    {
      control: "textbox: Error response # header # value",
      does: "That header's value template.",
    },
    {
      control: "button: Remove Error response # header #",
      does: "Removes the header.",
    },
    {
      control: "textbox: Error response # body",
      does: "The error body template, in the provider's real error shape.",
    },
    {
      control: "button: Add an error response",
      does: "Adds an error response.",
    },
    {
      control: "combobox: Callback template",
      does: "The webhook template status callbacks are sent with.",
      links: "[Webhooks > Templates](../../webhooks/templates.md).",
    },
    {
      control:
        "paragraph: The webhook template its status callbacks and inbound messages are sent with; edit it in Webhooks > Templates.",
      does: "Explains the callback template.",
    },
    {
      control:
        "paragraph: The provider's name for each SendMock status, as its callbacks and fetch answers show it.",
      does: "Explains the status names below.",
    },
    {
      control: "heading: Sample request",
      does: "The request the preview sends.",
    },
    {
      control:
        "paragraph: A send built from the field mapping. Edit it to try another request.",
      does: "Explains the sample.",
    },
    {
      control: "combobox: Sample method",
      does: "The sample's method.",
    },
    {
      control: "textbox: Sample path",
      does: "The sample's path.",
    },
    {
      control: "textbox: Sample body",
      does: "The sample's body.",
    },
    {
      control: "heading: Stored message",
      does: `The ${messageWord} SendMock would store for the sample.`,
      operationIds: [`post${operationArea}ProvidersByProviderKeyPreview`],
    },
    {
      control: "heading: Response",
      does: "The response the sample would get.",
    },
    {
      control: "textbox: Search the reference",
      does: "Filters the template reference: the values, functions and filters templates can use.",
    },
    {
      control: "heading: Values",
      does: "The values a template can read, with an example of each.",
    },
    {
      control: "each item, button: …",
      state: "Provider editor, Preview tab",
      does: "Inserts the value, function or filter into the template field you were editing.",
    },
    {
      control: "heading: Functions",
      does: "The functions a template can call.",
    },
    {
      control: "heading: Filters",
      does: "The filters a template can use.",
      links: "[Template filters](../../reference/template-filters.md).",
    },
    {
      control: "each item, button: … }}",
      does: "Inserts the function into the template field you were editing.",
    },
    {
      control: "button: Copy sdk base url (provider port)",
      does: "Copies the base URL to give the provider's SDK when the provider port is on.",
    },
    {
      control: "button: Copy base url on the main port",
      does: "Copies the base URL under `/providers/<key>/` on the main port.",
    },
    {
      control: "button: Copy a curl command",
      does: "Copies a curl command that sends the sample request.",
    },
    {
      control:
        "paragraph: The provider port answers once it is on ( --provider-addr ). The preview shows what this request gets back: #. Settings > Connection has the snippets for each language.",
      does: "Explains where the provider port comes from and what the sample gets back.",
    },
  ];
}
