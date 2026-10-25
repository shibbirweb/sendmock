import { CopyButton } from "@/components/common/copy-button";
import { formatHttpBody } from "@/features/logs/http/format-http-body";

/** A logged request or response body, formatted for reading (SM-13.4). */
export function HttpBodyView({
  title,
  bodyText,
  contentType = null,
}: {
  title: string;
  bodyText: string;
  contentType?: string | null;
}) {
  const formattedBody = formatHttpBody(bodyText, contentType);

  return (
    <section aria-label={title} className="grid gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-medium text-muted-foreground">{title}</h4>
        {formattedBody.kind !== "empty" && (
          <CopyButton
            copyText={bodyText}
            label={`Copy ${title.toLowerCase()}`}
            className="size-6"
          />
        )}
      </div>
      {formattedBody.kind === "empty" && (
        <p className="text-xs text-muted-foreground">Empty body</p>
      )}
      {formattedBody.kind === "form" && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-md border bg-muted/30 p-3 font-mono text-xs">
          {formattedBody.fields.map(([fieldName, fieldValue], fieldIndex) => (
            <div key={`${fieldName}-${fieldIndex}`} className="contents">
              <dt className="text-muted-foreground">{fieldName}</dt>
              <dd className="break-all">{fieldValue}</dd>
            </div>
          ))}
        </dl>
      )}
      {(formattedBody.kind === "json" || formattedBody.kind === "text") && (
        <pre className="max-h-80 overflow-auto rounded-md border bg-muted/30 p-3 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap">
          {formattedBody.text}
        </pre>
      )}
    </section>
  );
}
