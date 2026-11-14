import type { ReactNode } from "react";

/** Text with `code` spans, as the API descriptions write them. */
export function InlineCodeText({ text }: { text: string }) {
  return (
    <>
      {text.split("`").map((textPart, partIndex) =>
        partIndex % 2 === 1 ? (
          <code
            key={`${partIndex}-${textPart}`}
            className="font-mono text-xs text-fd-foreground"
          >
            {textPart}
          </code>
        ) : (
          textPart
        ),
      )}
    </>
  );
}

/** A value as readers type it: strings as they are, the rest as JSON. */
export function formatExampleValue(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

export type InputTableRow = {
  key: string;
  name: ReactNode;
  type: string;
  isRequired: boolean;
  description: string;
  allowedValues: unknown[] | null;
  example: unknown;
};

function InputDetails({ inputRow }: { inputRow: InputTableRow }) {
  const hasAllowedValues =
    inputRow.allowedValues !== null && inputRow.allowedValues.length > 0;
  const hasExample =
    inputRow.example !== undefined &&
    inputRow.example !== null &&
    (typeof inputRow.example !== "object" || Array.isArray(inputRow.example)) &&
    formatExampleValue(inputRow.example) !== "";

  return (
    <div className="grid gap-1">
      <span>
        <InlineCodeText text={inputRow.description} />
      </span>
      {hasAllowedValues && (
        <span>
          One of:{" "}
          {inputRow.allowedValues?.map((allowedValue, valueIndex) => (
            <span key={formatExampleValue(allowedValue)}>
              {valueIndex > 0 && ", "}
              <code className="font-mono text-xs text-fd-foreground">
                {formatExampleValue(allowedValue)}
              </code>
            </span>
          ))}
        </span>
      )}
      {hasExample && (
        <span>
          Example:{" "}
          <code className="font-mono text-xs text-fd-foreground break-all">
            {formatExampleValue(inputRow.example)}
          </code>
        </span>
      )}
    </div>
  );
}

/** Arguments, flags or tool inputs: name, type, whether required, and what they do. */
export function InputTable({
  label,
  nameHeading,
  inputRows,
}: {
  label: string;
  nameHeading: string;
  inputRows: InputTableRow[];
}) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table aria-label={label} className="w-full text-left text-sm">
        <thead className="bg-fd-muted text-fd-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-1.5 font-medium">
              {nameHeading}
            </th>
            <th scope="col" className="px-3 py-1.5 font-medium">
              Type
            </th>
            <th scope="col" className="px-3 py-1.5 font-medium">
              Description
            </th>
          </tr>
        </thead>
        <tbody>
          {inputRows.map((inputRow) => (
            <tr key={inputRow.key} className="border-t align-top">
              <td className="px-3 py-1.5 font-mono text-xs whitespace-nowrap">
                {inputRow.name}
                {inputRow.isRequired && (
                  <span className="ml-1 font-sans text-fd-muted-foreground">
                    required
                  </span>
                )}
              </td>
              <td className="px-3 py-1.5 font-mono text-xs">{inputRow.type}</td>
              <td className="px-3 py-1.5 text-fd-muted-foreground">
                <InputDetails inputRow={inputRow} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
