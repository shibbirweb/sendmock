import { LinkIcon, Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useEmailHtmlCheck,
  useEmailSpamCheck,
  useRunLinkCheck,
} from "@/lib/api/hooks/use-email-detail-queries";
import type { EmailDetail } from "@/lib/api/types";
import { cn } from "@/lib/utils";

function SupportBar({ supportPercent }: { supportPercent: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn(
          "h-full rounded-full",
          supportPercent >= 90
            ? "bg-emerald-500"
            : supportPercent >= 60
              ? "bg-amber-500"
              : "bg-destructive",
        )}
        style={{ width: `${supportPercent}%` }}
      />
    </div>
  );
}

function HtmlCompatibilitySection({ emailId }: { emailId: string }) {
  const htmlCheckQuery = useEmailHtmlCheck(emailId, true);

  if (htmlCheckQuery.isPending) {
    return <Skeleton className="h-32 w-full" />;
  }
  if (htmlCheckQuery.isError) {
    return (
      <p className="text-sm text-destructive">Could not run the HTML check.</p>
    );
  }

  const htmlCheckReport = htmlCheckQuery.data;

  return (
    <section className="grid gap-3">
      <h3 className="font-medium">
        HTML compatibility: {htmlCheckReport.overall_support_percent}%
      </h3>
      <ul className="grid gap-2 sm:grid-cols-2">
        {htmlCheckReport.clients.map((clientSupport) => (
          <li key={clientSupport.client} className="grid gap-1 text-sm">
            <span className="flex justify-between">
              {clientSupport.client}
              <span className="text-muted-foreground">
                {clientSupport.support_percent}%
              </span>
            </span>
            <SupportBar supportPercent={clientSupport.support_percent} />
          </li>
        ))}
      </ul>
      {htmlCheckReport.warnings.map((htmlWarning) => (
        <p key={htmlWarning.feature} className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">
            {htmlWarning.feature}
          </span>
          {htmlWarning.line !== null && ` (line ${htmlWarning.line})`}:{" "}
          {htmlWarning.note}
        </p>
      ))}
    </section>
  );
}

function LinkCheckSection({ emailId }: { emailId: string }) {
  const runLinkCheck = useRunLinkCheck();

  return (
    <section className="grid gap-3">
      <div className="flex items-center gap-3">
        <h3 className="font-medium">Links and images</h3>
        <Button
          variant="outline"
          size="sm"
          disabled={runLinkCheck.isPending}
          onClick={() => {
            runLinkCheck.mutate(emailId);
          }}
        >
          {runLinkCheck.isPending ? (
            <Loader2Icon className="animate-spin" />
          ) : (
            <LinkIcon />
          )}
          {runLinkCheck.data ? "Check again" : "Check links"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Runs only when you ask, because it makes real requests to every link.
      </p>
      {runLinkCheck.data?.map((linkResult) => (
        <div key={linkResult.url} className="flex items-center gap-2 text-sm">
          <span
            className={cn(
              "w-10 shrink-0 rounded px-1 text-center font-mono text-xs",
              linkResult.status_code !== null && linkResult.status_code < 400
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : "bg-destructive/10 text-destructive",
            )}
          >
            {linkResult.status_code ?? "ERR"}
          </span>
          <span className="truncate">{linkResult.url}</span>
          <span className="ml-auto shrink-0 text-xs text-muted-foreground">
            {linkResult.kind}
            {linkResult.duration_ms !== null &&
              ` · ${linkResult.duration_ms} ms`}
          </span>
        </div>
      ))}
    </section>
  );
}

function SpamCheckSection({ emailId }: { emailId: string }) {
  const spamCheckQuery = useEmailSpamCheck(emailId, true);
  const spamReport = spamCheckQuery.data;

  if (
    spamReport === undefined ||
    !spamReport.is_available ||
    spamReport.score === null
  ) {
    return null;
  }

  return (
    <section className="grid gap-2">
      <h3 className="font-medium">
        Spam score: {spamReport.score} / {spamReport.threshold}
      </h3>
      <SupportBar
        supportPercent={Math.max(
          0,
          100 - (spamReport.score / spamReport.threshold) * 100,
        )}
      />
      <ul className="grid gap-1 text-sm">
        {spamReport.rules.map((spamRule) => (
          <li key={spamRule.name} className="flex gap-2">
            <code className="w-10 shrink-0 text-right">
              {spamRule.score.toFixed(1)}
            </code>
            <span className="font-mono text-xs">{spamRule.name}</span>
            <span className="text-muted-foreground">
              {spamRule.description}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** HTML compatibility, link check and spam score (EM-13). */
export function EmailChecksTab({ email }: { email: EmailDetail }) {
  return (
    <div className="grid gap-8">
      {email.html_body !== null && (
        <HtmlCompatibilitySection emailId={email.id} />
      )}
      <LinkCheckSection emailId={email.id} />
      <SpamCheckSection emailId={email.id} />
    </div>
  );
}
