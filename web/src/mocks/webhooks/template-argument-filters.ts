import { readPaymentProviderEventName } from "@/lib/payments/payment-provider-event-names";

/** Filters that take arguments, as `name("a", "b")` after a pipe. */
type ArgumentFilter = (
  filterInput: unknown,
  filterArguments: string[],
) => unknown;

const shortWeekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const shortMonthNames = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

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
    a: shortWeekdayNames[parsedDate.getUTCDay()] ?? "",
    b: shortMonthNames[parsedDate.getUTCMonth()] ?? "",
    s: String(Math.floor(parsedDate.getTime() / 1000)),
  };

  return formatText.replace(
    /%([YymdHMSsab%])/g,
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
  payment_event: (filterInput, [provider = ""]) =>
    readPaymentProviderEventName(String(filterInput), provider),
};
