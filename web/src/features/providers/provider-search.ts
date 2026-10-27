/** `?provider=<key>` opens that provider's sheet, e.g. from a message's badge. */
export type ProviderSearch = { provider?: string };

export function readProviderSearch(
  search: Record<string, unknown>,
): ProviderSearch {
  return typeof search.provider === "string" && search.provider !== ""
    ? { provider: search.provider }
    : {};
}
