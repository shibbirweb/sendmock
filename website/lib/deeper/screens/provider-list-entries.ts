import type { DeeperEntry } from "../deeper-types";
import type { ProviderEditorArea } from "./provider-editor-entries";

/** Where a providers screen sits: Mail or SMS, and its guide page. */
export type ProviderListArea = ProviderEditorArea & {
  areaTitle: "Email" | "SMS";
  menuTitle: "Mail" | "SMS";
  guidePage: string;
};

/** The providers list, the Add a provider dialog and the failing state, for Mail and SMS. */
export function buildProviderListEntries({
  messageWord,
  operationArea,
  areaTitle,
  menuTitle,
  guidePage,
}: ProviderListArea): DeeperEntry[] {
  return [
    {
      control: "heading: Providers",
      does: "Names the open screen in the header.",
    },
    {
      control: "link: Read the Providers guide",
      does: "Opens this screen's page in the user guide, in a new tab.",
      links: `[${menuTitle} > Providers](../../${guidePage}).`,
    },
    {
      control: `heading: ${areaTitle} providers`,
      does: `The list of ${messageWord} APIs SendMock answers.`,
      operationIds: [`get${operationArea}Providers`],
    },
    {
      control: `paragraph: The ${messageWord} APIs SendMock answers like the real provider. Change a built-in, remove the ones you do not use, or add your own.`,
      does: "Explains the screen.",
    },
    {
      control: "button: Add provider",
      does: "Opens Add a provider, or (in the dialog) adds it and opens its editor.",
      operationIds: [`post${operationArea}Providers`],
    },
    {
      control: "columnheader: Provider",
      does: "The provider's name and whether it is built in, modified or your own.",
    },
    {
      control: "columnheader: Key",
      does: "Its key: the `/providers/<key>/` path and the source stored on its messages.",
    },
    {
      control: "columnheader: Last # hours",
      does: "How many messages it took in the last 24 hours.",
    },
    {
      control: "columnheader: Enabled",
      does: "Whether it answers requests.",
    },
    {
      control: "each item, switch: … enabled",
      does: "Turns the provider on or off at once; while off, its paths answer 404.",
      operationIds: [`patch${operationArea}ProvidersByProviderKey`],
    },
    {
      control: "each item, button: …",
      does: "Opens the provider's editor.",
      operationIds: [`get${operationArea}ProvidersByProviderKey`],
    },
    {
      control: "heading: Add a provider",
      does: "The Add a provider dialog.",
    },
    {
      control: `paragraph: Answer a provider SendMock does not ship, from blank or from the closest ${messageWord} provider; you set its requests and responses next.`,
      does: "Explains what adding does.",
      links:
        "[Advanced: create an email provider](../../advanced/email-provider.md).",
    },
    {
      control: "combobox: Start from",
      does: "Blank, or a built-in to copy as the starting point.",
    },
    {
      control: "button: Cancel",
      does: "Closes the dialog or editor without saving.",
    },
    {
      control: "button: Close",
      does: "Closes the dialog or editor without saving.",
    },
    {
      control: "alert: Could not load the providers. Try again",
      does: "Shown when the list could not be loaded.",
      errors: "Check SendMock is running, then press Try again.",
    },
    {
      control: "paragraph: Could not load the providers.",
      does: "The message inside the alert.",
    },
    {
      control: "button: Try again",
      does: "Loads the list again.",
      operationIds: [`get${operationArea}Providers`],
    },
  ];
}
