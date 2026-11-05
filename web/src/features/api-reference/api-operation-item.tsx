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
    <table className="w-full text-left text-xs">
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

  return (
    <li data-testid="api-operation" className="rounded-md border">
      <details>
        <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-3 py-2 text-sm">
          <HttpMethodBadge method={referenceOperation.method} />
          <code className="font-mono break-all">{referenceOperation.path}</code>
          <span className="text-muted-foreground">
            {referenceOperation.summary}
          </span>
        </summary>
        <div className="grid gap-3 border-t px-3 py-3 text-sm">
          <p className="text-xs text-muted-foreground">
            Operation{" "}
            <code className="font-mono">{referenceOperation.operationId}</code>
          </p>
          <OperationParameters referenceOperation={referenceOperation} />
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            <dt className="text-muted-foreground">Body</dt>
            <dd className="font-mono">
              {referenceOperation.requestBodyType ?? "None"}
            </dd>
            <dt className="text-muted-foreground">
              Answer {referenceOperation.successStatus}
            </dt>
            <dd className="font-mono">
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
      </details>
    </li>
  );
}
