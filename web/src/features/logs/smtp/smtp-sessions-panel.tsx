import { Link } from "@tanstack/react-router";
import { SearchIcon, ServerIcon } from "lucide-react";
import * as React from "react";

import { FilterChip } from "@/components/common/filter-chip";
import { LoadMoreRows } from "@/components/common/load-more-rows";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  type SmtpResultFilter,
  smtpResultFilters,
} from "@/features/logs/logs-labels";
import { SmtpResultBadge } from "@/features/logs/smtp/smtp-result-badge";
import { useSmtpSessions } from "@/lib/api/hooks/use-logs-queries";
import type { SmtpSession } from "@/lib/api/types";
import {
  formatDateTime,
  formatDurationMs,
  formatRelativeTime,
} from "@/lib/format/format-values";
import { cn } from "@/lib/utils";

function SmtpSessionRow({ smtpSession }: { smtpSession: SmtpSession }) {
  const isFailed = smtpSession.result !== "delivered";
  const durationMs =
    Date.parse(smtpSession.ended_at) - Date.parse(smtpSession.started_at);

  return (
    <TableRow className={cn("relative", isFailed && "bg-destructive/5")}>
      <TableCell className="whitespace-nowrap text-muted-foreground">
        <time
          dateTime={smtpSession.started_at}
          title={formatDateTime(smtpSession.started_at)}
        >
          {formatRelativeTime(smtpSession.started_at)}
        </time>
      </TableCell>
      <TableCell className="max-w-48">
        <Link
          to="/logs"
          search={{ session: smtpSession.id }}
          className="block truncate font-medium after:absolute after:inset-0 focus-visible:outline-none"
        >
          {smtpSession.helo_name}
        </Link>
        <span className="block truncate font-mono text-xs text-muted-foreground">
          {smtpSession.remote_address}
        </span>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        {smtpSession.tls_version ?? (
          <span className="text-muted-foreground">Plain</span>
        )}
      </TableCell>
      <TableCell className="hidden md:table-cell">
        {smtpSession.auth_user === null ? (
          <span className="text-muted-foreground">None</span>
        ) : (
          <span>
            {smtpSession.auth_user}{" "}
            <span className="text-xs text-muted-foreground">
              {smtpSession.auth_mechanism}
            </span>
          </span>
        )}
      </TableCell>
      <TableCell className="max-w-64">
        <SmtpResultBadge sessionResult={smtpSession.result} />
        {smtpSession.failure_reason !== null && (
          <span className="mt-0.5 block truncate text-xs text-destructive">
            {smtpSession.failure_reason}
          </span>
        )}
      </TableCell>
      <TableCell className="hidden tabular-nums sm:table-cell">
        {smtpSession.email_ids.length}
      </TableCell>
      <TableCell className="hidden whitespace-nowrap tabular-nums sm:table-cell">
        {formatDurationMs(durationMs)}
      </TableCell>
    </TableRow>
  );
}

/** SMTP sessions, failed ones highlighted (EM-09.1, EM-09.4). */
export function SmtpSessionsPanel() {
  const [resultFilter, setResultFilter] =
    React.useState<SmtpResultFilter>("all");
  const [searchText, setSearchText] = React.useState("");
  const selectedResults =
    smtpResultFilters.find(
      (filterOption) => filterOption.resultFilter === resultFilter,
    )?.results ?? null;
  const sessionsQuery = useSmtpSessions({
    result: selectedResults?.join(","),
    query: searchText.trim() || undefined,
  });
  const loadedPages = sessionsQuery.data?.pages ?? [];
  const smtpSessions = loadedPages.flatMap((loadedPage) => loadedPage.items);
  const totalCount = loadedPages[0]?.total_count ?? 0;
  const { fetchNextPage } = sessionsQuery;
  const loadNextPage = React.useCallback(() => {
    void fetchNextPage();
  }, [fetchNextPage]);

  return (
    <div className="grid min-w-0 grid-cols-1 gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {smtpResultFilters.map((filterOption) => (
            <FilterChip
              key={filterOption.resultFilter}
              isActive={resultFilter === filterOption.resultFilter}
              onToggle={() => {
                setResultFilter(filterOption.resultFilter);
              }}
            >
              {filterOption.label}
            </FilterChip>
          ))}
        </div>
        <div className="relative w-full sm:ml-auto sm:w-64">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchText}
            onChange={(changeEvent) => {
              setSearchText(changeEvent.target.value);
            }}
            placeholder="Client, EHLO name or user"
            aria-label="Search SMTP sessions"
            className="pl-8"
          />
        </div>
      </div>
      <div className="min-w-0 rounded-lg border">
        {sessionsQuery.isPending && (
          <div className="grid gap-2 p-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        )}
        {sessionsQuery.isSuccess && smtpSessions.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <ServerIcon className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">No SMTP sessions</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Point your app's SMTP settings at SendMock; every connection shows
              up here, even the ones that fail.
            </p>
          </div>
        )}
        {smtpSessions.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Client</TableHead>
                <TableHead className="hidden md:table-cell">TLS</TableHead>
                <TableHead className="hidden md:table-cell">AUTH</TableHead>
                <TableHead>Result</TableHead>
                <TableHead className="hidden sm:table-cell">Emails</TableHead>
                <TableHead className="hidden sm:table-cell">Duration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {smtpSessions.map((smtpSession) => (
                <SmtpSessionRow
                  key={smtpSession.id}
                  smtpSession={smtpSession}
                />
              ))}
            </TableBody>
          </Table>
        )}
        {smtpSessions.length > 0 && (
          <LoadMoreRows
            shownCount={smtpSessions.length}
            totalCount={totalCount}
            hasNextPage={sessionsQuery.hasNextPage}
            isFetchingNextPage={sessionsQuery.isFetchingNextPage}
            onLoadMore={loadNextPage}
          />
        )}
      </div>
    </div>
  );
}
