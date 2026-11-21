/** The bin "Create a bin for this provider" makes: the key in lowercase, then `-gaps`. */
export function toProviderBinName(providerKey: string): string {
  const safeKey = providerKey
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^[-_]+/, "")
    .slice(0, 35);

  return `${safeKey || "provider"}-gaps`;
}
