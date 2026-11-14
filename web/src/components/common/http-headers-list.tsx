/** Recorded HTTP headers as name / value rows. */
export function HttpHeadersList({
  title,
  headers,
}: {
  title: string;
  headers: Record<string, string>;
}) {
  const headerEntries = Object.entries(headers);

  return (
    <section aria-label={title} className="grid gap-1.5">
      <h4 className="text-xs font-medium text-muted-foreground">{title}</h4>
      {headerEntries.length === 0 ? (
        <p className="text-xs text-muted-foreground">No headers recorded</p>
      ) : (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-md border bg-muted/30 p-3 font-mono text-xs">
          {headerEntries.map(([headerName, headerValue]) => (
            <div key={headerName} className="contents">
              <dt className="text-muted-foreground">{headerName}</dt>
              <dd className="break-all">{headerValue}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
