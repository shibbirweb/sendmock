import type { PlaygroundResponse } from "@/lib/playground/bridge-messages";

function formatBody(response: PlaygroundResponse): string {
  if (response.isBinary) {
    return response.body;
  }
  try {
    return JSON.stringify(JSON.parse(response.body), null, 2);
  } catch {
    return response.body === "" ? "(empty body)" : response.body;
  }
}

/** Status, timing, content type and the pretty-printed body of an answer. */
export function ResponseViewer({ response }: { response: PlaygroundResponse }) {
  const isSuccess = response.status < 400;

  return (
    <div className="grid gap-2" aria-live="polite">
      <p className="flex flex-wrap items-center gap-3 text-xs">
        <span
          data-testid="response-status"
          className={
            isSuccess
              ? "rounded bg-fd-primary px-1.5 py-0.5 font-mono font-semibold text-fd-primary-foreground"
              : "rounded bg-fd-muted px-1.5 py-0.5 font-mono font-semibold"
          }
        >
          {response.status}
        </span>
        <span className="text-fd-muted-foreground">
          {response.durationMs} ms
        </span>
        <span className="font-mono text-fd-muted-foreground">
          {response.headers["content-type"] ?? "no content"}
        </span>
      </p>
      <pre className="max-h-80 overflow-auto rounded-lg border bg-fd-muted p-3 font-mono text-xs">
        {formatBody(response)}
      </pre>
    </div>
  );
}
