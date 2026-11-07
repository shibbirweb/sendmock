import * as React from "react";

import { CopyButton } from "@/components/common/copy-button";
import { HttpMethodBadge } from "@/features/http/requests/http-method-badge";
import {
  buildCurlCommand,
  type ReferenceOperation,
} from "@/lib/api/openapi-reference";

function OperationParameters({
  referenceOperation,
}: {
  referenceOperation: ReferenceOperation;
}) {
  if (referenceOperation.parameters.length === 0) {
    return null;
  }

  return (
    <table className="w-full table-fixed text-left text-xs break-words">
      <caption className="sr-only">
        Parameters of {referenceOperation.operationId}
      </caption>
      <thead className="text-muted-foreground">
        <tr>
          <th className="py-1 pr-2 font-medium">Parameter</th>
          <th className="py-1 pr-2 font-medium">In</th>
          <th className="py-1 font-medium">Description</th>
        </tr>
      </thead>
      <tbody>
        {referenceOperation.parameters.map((parameter) => (
          <tr
            key={`${parameter.location}-${parameter.name}`}
            className="border-t"
          >
            <td className="py-1 pr-2 font-mono">
              {parameter.name}
              {parameter.isRequired && (
                <span className="text-muted-foreground"> (required)</span>
              )}
            </td>
            <td className="py-1 pr-2">{parameter.location}</td>
            <td className="py-1">{parameter.description}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** One operation: its line, then on opening its parameters, body, answer and `curl` (PL-01.4). */
export function ApiOperationItem({
  referenceOperation,
  instanceOrigin,
}: {
  referenceOperation: ReferenceOperation;
  instanceOrigin: string;
}) {
  const curlCommand = buildCurlCommand(referenceOperation, instanceOrigin);
  // Closed details still lay out their content, so it is rendered only once opened.
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <li data-testid="api-operation" className="min-w-0 rounded-md border">
      <details
        onToggle={(toggleEvent) => setIsOpen(toggleEvent.currentTarget.open)}
      >
        <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-3 py-2 text-sm">
          <HttpMethodBadge method={referenceOperation.method} />
          <code className="font-mono break-all">{referenceOperation.path}</code>
          <span className="text-muted-foreground">
            {referenceOperation.summary}
          </span>
        </summary>
        {isOpen && (
          <div className="grid min-w-0 gap-3 border-t px-3 py-3 text-sm">
            <p className="text-xs break-all text-muted-foreground">
              Operation{" "}
              <code className="font-mono">
                {referenceOperation.operationId}
              </code>
            </p>
            <OperationParameters referenceOperation={referenceOperation} />
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
              <dt className="text-muted-foreground">Body</dt>
              <dd className="font-mono break-all">
                {referenceOperation.requestBodyType ?? "None"}
              </dd>
              <dt className="text-muted-foreground">
                Answer {referenceOperation.successStatus}
              </dt>
              <dd className="font-mono break-all">
                {referenceOperation.responseType ?? "No content"}
              </dd>
            </dl>
            <div className="flex items-start gap-2">
              <pre className="min-w-0 flex-1 overflow-x-auto rounded bg-muted p-2 font-mono text-xs">
                {curlCommand}
              </pre>
              <CopyButton
                copyText={curlCommand}
                label={`Copy curl for ${referenceOperation.operationId}`}
              />
            </div>
          </div>
        )}
      </details>
    </li>
  );
}
