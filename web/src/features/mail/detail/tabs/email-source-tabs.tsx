import { AlertTriangleIcon, CheckCircle2Icon } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import {
  useEmailRawSource,
  useListUnsubscribeCheck,
} from "@/lib/api/hooks/use-email-detail-queries";
import type { EmailDetail } from "@/lib/api/types";

export function EmailTextTab({ email }: { email: EmailDetail }) {
  if (email.text_body === null) {
    return (
      <p className="text-sm text-muted-foreground">
        This email has no plain-text part.
      </p>
    );
  }

  return (
    <pre className="text-sm leading-relaxed break-words whitespace-pre-wrap">
      {email.text_body}
    </pre>
  );
}

/** The original message, header names emphasised for easy scanning. */
export function EmailSourceTab({ email }: { email: EmailDetail }) {
  const rawSourceQuery = useEmailRawSource(email.id, true);

  if (rawSourceQuery.isPending) {
    return <Skeleton className="h-64 w-full" />;
  }
  if (rawSourceQuery.isError) {
    return (
      <p className="text-sm text-destructive">Could not load the source.</p>
    );
  }

  const [headerSection = "", ...bodySections] =
    rawSourceQuery.data.split(/\r?\n\r?\n/);

  return (
    <pre className="overflow-x-auto rounded-md border bg-muted/30 p-3 font-mono text-xs leading-relaxed">
      {headerSection.split(/\r?\n/).map((headerLine, lineIndex) => {
        const colonIndex = headerLine.indexOf(":");

        return (
          <div key={lineIndex}>
            {colonIndex > 0 ? (
              <>
                <span className="font-semibold text-primary">
                  {headerLine.slice(0, colonIndex)}
                </span>
                {headerLine.slice(colonIndex)}
              </>
            ) : (
              headerLine
            )}
          </div>
        );
      })}
      {"\n"}
      <span className="text-muted-foreground">{bodySections.join("\n\n")}</span>
    </pre>
  );
}

export function EmailHeadersTab({ email }: { email: EmailDetail }) {
  const listUnsubscribeQuery = useListUnsubscribeCheck(email.id);
  const listUnsubscribeReport = listUnsubscribeQuery.data;

  return (
    <div className="grid gap-4">
      {listUnsubscribeReport?.has_header && (
        <div className="grid gap-1 rounded-md border p-3 text-sm">
          <span className="flex items-center gap-2 font-medium">
            {listUnsubscribeReport.warnings.length === 0 ? (
              <CheckCircle2Icon className="size-4 text-success" />
            ) : (
              <AlertTriangleIcon className="size-4 text-warning" />
            )}
            List-Unsubscribe
            {listUnsubscribeReport.supports_one_click &&
              " (one-click supported)"}
          </span>
          {listUnsubscribeReport.warnings.map((warningText) => (
            <span key={warningText} className="text-muted-foreground">
              {warningText}
            </span>
          ))}
        </div>
      )}
      <Table>
        <TableBody>
          {Object.entries(email.headers).flatMap(([headerName, headerValues]) =>
            headerValues.map((headerValue, valueIndex) => (
              <TableRow key={`${headerName}-${valueIndex}`}>
                <TableCell className="w-40 align-top font-medium">
                  {headerName}
                </TableCell>
                <TableCell className="font-mono text-xs break-all whitespace-normal">
                  {headerValue}
                </TableCell>
              </TableRow>
            )),
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export function EmailTemplateDataTab({ email }: { email: EmailDetail }) {
  if (email.template === null) {
    return null;
  }

  return (
    <div className="grid gap-2 text-sm">
      <p>
        Sent with provider template{" "}
        <code className="rounded bg-muted px-1.5 py-0.5">
          {email.template.template_id}
        </code>
        . The template content lives at the provider, so only the data is shown.
      </p>
      <pre className="overflow-x-auto rounded-md border bg-muted/30 p-3 font-mono text-xs">
        {JSON.stringify(email.template.template_data, null, 2)}
      </pre>
    </div>
  );
}
