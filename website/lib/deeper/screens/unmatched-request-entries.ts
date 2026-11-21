import type { DeeperEntry } from "../deeper-types";

/** The Unmatched requests section of a provider's or gateway's General tab (PL-21). */
export function buildUnmatchedRequestEntries(providerName: string): DeeperEntry[] {
  return [
    {
      control: "heading: Unmatched requests",
      does: `Sends the requests SendMock does not answer on ${providerName}'s base URL to an HTTP Catcher bin, which answers them with its rules.`,
      links: "[Provider gaps](../../http/provider-gaps.md)",
    },
    {
      control: `paragraph: Requests on ${providerName}'s base URL that SendMock does not answer. Send them to a bin to answer them with its rules and follow-up webhooks.`,
      does: "Explains Unmatched requests: built-in operations still answer first.",
    },
    {
      control: `combobox: Where ${providerName}'s unmatched requests go`,
      does: "Chooses the bin that answers them, or none (they get `404`). A provider has one bin at most; a bin can serve several providers.",
      changes: "Attaches or detaches the bin right away, with no restart.",
      operationIds: [
        "putProviderBinsByAreaByProviderKey",
        "deleteProviderBinsByAreaByProviderKey",
      ],
    },
    {
      control: "button: Create a bin for this provider",
      does: "Creates a bin named after the provider and attaches it, so you can add a rule for the endpoint next.",
      changes: "Adds an HTTP Catcher bin.",
      operationIds: ["putProviderBinsByAreaByProviderKey"],
    },
  ];
}
