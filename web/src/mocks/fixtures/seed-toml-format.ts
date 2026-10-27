/** TOML writing shared by the seed file sections (PL-04). */

export type TomlValue = string | number | boolean | string[] | null;

function formatTomlValue(tomlValue: Exclude<TomlValue, null>): string {
  if (Array.isArray(tomlValue)) {
    return `[${tomlValue.map((arrayItem) => JSON.stringify(arrayItem)).join(", ")}]`;
  }

  return typeof tomlValue === "string"
    ? JSON.stringify(tomlValue)
    : String(tomlValue);
}

/** `key = value` lines, skipping nulls (TOML has no null). */
export function formatTomlTable(
  tableHeader: string,
  tableEntries: Record<string, TomlValue>,
): string {
  const valueLines = Object.entries(tableEntries)
    .filter(([, tomlValue]) => tomlValue !== null)
    .map(
      ([tableKey, tomlValue]) =>
        `${tableKey} = ${formatTomlValue(tomlValue as Exclude<TomlValue, null>)}`,
    );

  return [tableHeader, ...valueLines].join("\n");
}

export function toSecretReference(itemName: string): string {
  return `\${${itemName.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_SECRET}`;
}
