import { CopyButton } from "@/components/common/copy-button";
import type { MessageProviderForm } from "@/features/providers/use-message-provider-form";

/** The provider port, where SDKs whose host is swapped send (docs/plan/02-architecture.md). */
const providerPortUrl = "http://127.0.0.1:8026";
/** The same routes under /providers/<key>/ on the main port. */
const mainPortUrl = "http://127.0.0.1:8025";

function CommandBlock({ label, command }: { label: string; command: string }) {
  return (
    <div className="grid gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <CopyButton copyText={command} label={`Copy ${label.toLowerCase()}`} />
      </div>
      <pre className="overflow-x-auto rounded-md bg-muted p-2 font-mono text-xs">
        {command}
      </pre>
    </div>
  );
}

/** A ready `curl` command and the base URLs for this provider's SDK. */
export function ProviderTryItTab({
  providerForm,
}: {
  providerForm: MessageProviderForm;
}) {
  const { providerInput, previewQuery } = providerForm;
  const firstOperation = providerInput.operations[0];
  const samplePath =
    firstOperation?.path.replace(/\{[^}]+\}/g, "example") ?? "/";
  const contentType =
    firstOperation?.request_format === "json"
      ? "application/json"
      : "application/x-www-form-urlencoded";
  const exampleBody =
    providerForm.sampleRequest?.body ??
    (firstOperation?.request_format === "json" ? "{}" : "");
  const curlCommand = [
    `curl -X ${firstOperation?.method ?? "POST"} ${providerPortUrl}${samplePath}`,
    providerInput.host === null ? null : `  -H "Host: ${providerInput.host}"`,
    `  -H "Content-Type: ${contentType}"`,
    `  -d '${exampleBody}'`,
  ]
    .filter((commandLine) => commandLine !== null)
    .join(" \\\n");

  return (
    <div className="grid max-w-2xl content-start gap-4">
      <CommandBlock
        label="SDK base URL (provider port)"
        command={providerPortUrl}
      />
      <CommandBlock
        label="Base URL on the main port"
        command={`${mainPortUrl}/providers/${providerInput.key}`}
      />
      <CommandBlock label="A curl command" command={curlCommand} />
      <p className="text-xs text-muted-foreground">
        The provider port answers once it is on (
        <code className="font-mono">--provider-addr</code>). The preview shows
        what this request gets back
        {previewQuery.data === undefined
          ? "."
          : `: ${previewQuery.data.response.status}.`}{" "}
        Settings &gt; Connection has the snippets for each language.
      </p>
    </div>
  );
}
