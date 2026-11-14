import type { PaymentDetail } from "@/lib/api/types";
import { cn } from "@/lib/utils";

/** The success, fail and cancel URLs, which one was used and what it got (PY-09.2). */
export function PaymentRedirects({
  paymentDetail,
}: {
  paymentDetail: PaymentDetail;
}) {
  const redirectUrls = [
    { outcome: "success", label: "Success", url: paymentDetail.success_url },
    { outcome: "fail", label: "Fail", url: paymentDetail.fail_url },
    { outcome: "cancel", label: "Cancel", url: paymentDetail.cancel_url },
  ].filter((redirectUrl) => redirectUrl.url !== null);
  if (redirectUrls.length === 0) {
    return null;
  }
  const usedRedirect = paymentDetail.redirect;

  return (
    <section aria-label="Redirects" className="grid gap-2">
      <h3 className="text-sm font-semibold">Redirects</h3>
      <ul className="grid gap-1 text-sm">
        {redirectUrls.map((redirectUrl) => {
          const isUsed = usedRedirect?.outcome === redirectUrl.outcome;
          return (
            <li
              key={redirectUrl.outcome}
              className={cn(
                "flex flex-wrap gap-2",
                !isUsed && "text-muted-foreground",
              )}
            >
              <span className="w-16 shrink-0">{redirectUrl.label}</span>
              <span className="min-w-0 font-mono text-xs break-all">
                {redirectUrl.url}
              </span>
              {isUsed && (
                <span className="rounded bg-muted px-1.5 text-[11px] font-medium text-foreground">
                  Used, {usedRedirect.method}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {usedRedirect !== null && Object.keys(usedRedirect.fields).length > 0 && (
        <dl
          aria-label="Redirect fields"
          className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 rounded-md border bg-muted/30 p-3 font-mono text-xs"
        >
          {Object.entries(usedRedirect.fields).map(
            ([fieldName, fieldValue]) => (
              <div key={fieldName} className="contents">
                <dt className="text-muted-foreground">{fieldName}</dt>
                <dd className="break-all">{fieldValue}</dd>
              </div>
            ),
          )}
        </dl>
      )}
    </section>
  );
}
