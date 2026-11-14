const monthPattern =
  "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";

/** The crawl's name (`#` a number, `#:#` a time, `Month`, `…` any text) as a pattern for the live name. */
export function toNamePattern(inventoryName: string): RegExp {
  const escapedName = inventoryName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const namePattern = escapedName
    .replace(/#:#/g, "\\d+(?::\\d+)+(?: ?[AP]M)?")
    .replace(/#/g, "\\d+")
    .replace(/…/g, ".*")
    .replace(/\bMonth\b/g, monthPattern);
  return new RegExp(`^${namePattern}$`);
}
