/** Filters that take arguments, as `name("a", "b")` after a pipe. */
type ArgumentFilter = (
  filterInput: unknown,
  filterArguments: string[],
) => unknown;

function padTwoDigits(datePart: number): string {
  return String(datePart).padStart(2, "0");
}

/** The `strftime` codes the built-in templates use, in UTC. */
function formatUtcDate(dateInput: unknown, formatText: string): string {
  const parsedDate = new Date(String(dateInput));
  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }
  const dateParts: Record<string, string> = {
    Y: String(parsedDate.getUTCFullYear()),
    y: padTwoDigits(parsedDate.getUTCFullYear() % 100),
    m: padTwoDigits(parsedDate.getUTCMonth() + 1),
    d: padTwoDigits(parsedDate.getUTCDate()),
    H: padTwoDigits(parsedDate.getUTCHours()),
    M: padTwoDigits(parsedDate.getUTCMinutes()),
    S: padTwoDigits(parsedDate.getUTCSeconds()),
  };

  return formatText.replace(
    /%([YymdHMS%])/g,
    (_, formatCode: string) => dateParts[formatCode] ?? "%",
  );
}

export const argumentFilters: Record<string, ArgumentFilter> = {
  replace: (filterInput, [searchText = "", replacementText = ""]) =>
    String(filterInput).split(searchText).join(replacementText),
  regex_extract: (filterInput, [patternText = ""]) =>
    new RegExp(patternText).exec(String(filterInput))?.[0] ?? "",
  date: (filterInput, [formatText = "%Y-%m-%dT%H:%M:%SZ"]) =>
    formatUtcDate(filterInput, formatText),
};
