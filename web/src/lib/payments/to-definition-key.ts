/** "Upay Wallet" as a method or flow key: "upay_wallet". */
export function toDefinitionKey(definitionName: string): string {
  return definitionName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^(\d)/, "m_$1")
    .slice(0, 32);
}
