import { Link } from "@tanstack/react-router";
import { GlobeIcon, SearchIcon } from "lucide-react";
import * as React from "react";

import { FilterChip } from "@/components/common/filter-chip";
import { LoadMoreRows } from "@/components/common/load-more-rows";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { HttpStatusBadge } from "@/features/logs/http/http-status-badge";
import {
  apiFilterOptions,
  isRejectedStatus,
  readApiLabel,
  statusClassFilters,
} from "@/features/logs/logs-labels";
import { useApiRequestLog } from "@/lib/api/hooks/use-logs-queries";
import type { ApiRequestLogEntry, ApiStatusClass } from "@/lib/api/types";
import {
  formatDateTime,
  formatDurationMs,
  formatRelativeTime,
} from "@/lib/format/format-values";
import { cn } from "@/lib/utils";

const allApis = "all";

function ApiRequestRow({ apiRequest }: { apiRequest: ApiRequestLogEntry }) {
  return (
    <TableRow
      className={cn(
        "relative",
        isRejectedStatus(apiRequest.response_status) && "bg-destructive/5",
      )}
    >
      <TableCell className="whitespace-nowrap text-muted-foreground">
        <time
          dateTime={apiRequest.created_at}
          title={formatDateTime(apiRequest.created_at)}
        >
          {formatRelativeTime(apiRequest.created_at)}
        </time>
      </TableCell>
      <TableCell className="hidden sm:table-cell">
        <span className="rounded border px-1 text-[10px] uppercase">
          {readApiLabel(apiRequest.api)}
        </span>
      </TableCell>
      <TableCell className="w-full max-w-0">
        <Link
          to="/logs"
          search={{ tab: "http", request: apiRequest.id }}
          className="flex min-w-0 items-center gap-2 font-mono text-xs after:absolute after:inset-0 focus-visible:outline-none"
        >
          <span className="shrink-0 font-semibold">{apiRequest.method}</span>
          <span className="min-w-0 truncate" title={apiRequest.path}>
            {apiRequest.path}
          </span>
        </Link>
      </TableCell>
      <TableCell>
        <HttpStatusBadge statusCode={apiRequest.response_status} />
      </TableCell>
      <TableCell className="hidden whitespace-nowrap tabular-nums md:table-cell">
        {formatDurationMs(apiRequest.duration_ms)}
      </TableCell>
    </TableRow>
  );
}

/** Requests to native and provider APIs, rejected ones highlighted (SM-13). */
export function ApiRequestsPanel() {
  const [statusClass, setStatusClass] = React.useState<ApiStatusClass | null>(
    null,
  );
  const [apiFilter, setApiFilter] = React.useState(allApis);
  const [pathSearch, setPathSearch] = React.useState("");
  const requestsQuery = useApiRequestLog({
    status_class: statusClass ?? undefined,
    api: apiFilter === allApis ? undefined : apiFilter,
    path: pathSearch.trim() || undefined,
  });
  const loadedPages = requestsQuery.data?.pages ?? [];
  const apiRequests = loadedPages.flatMap((loadedPage) => loadedPage.items);
  const totalCount = loadedPages[0]?.total_count ?? 0;
  const { fetchNextPage } = requestsQuery;
  const loadNextPage = React.useCallback(() => {
    void fetchNextPage();
  }, [fetchNextPage]);

  return (
    <div className="grid min-w-0 grid-cols-1 gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {statusClassFilters.map((filterOption) => (
            <FilterChip
              key={filterOption.label}
              isActive={statusClass === filterOption.statusClass}
              onToggle={() => {
                setStatusClass(filterOption.statusClass);
              }}
            >
              {filterOption.label}
            </FilterChip>
          ))}
        </div>
        <div className="flex w-full gap-2 sm:ml-auto sm:w-auto">
          <Select value={apiFilter} onValueChange={setApiFilter}>
            <SelectTrigger aria-label="Filter by API" className="w-36 shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={allApis}>All APIs</SelectItem>
              {apiFilterOptions.map((apiName) => (
                <SelectItem key={apiName} value={apiName}>
                  {readApiLabel(apiName)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative min-w-0 flex-1 sm:w-56 sm:flex-none">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={pathSearch}
              onChange={(changeEvent) => {
                setPathSearch(changeEvent.target.value);
              }}
              placeholder="Search paths"
              aria-label="Search request paths"
              className="pl-8"
            />
          </div>
        </div>
      </div>
      <div className="min-w-0 rounded-lg border">
        {requestsQuery.isPending && (
          <div className="grid gap-2 p-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        )}
        {requestsQuery.isSuccess && apiRequests.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <GlobeIcon className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">No requests match</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Calls to the native API and to emulated provider APIs (Twilio,
              SendGrid, ...) appear here, including rejected ones.
            </p>
          </div>
        )}
        {apiRequests.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead className="hidden sm:table-cell">API</TableHead>
                <TableHead>Request</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Duration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {apiRequests.map((apiRequest) => (
                <ApiRequestRow key={apiRequest.id} apiRequest={apiRequest} />
              ))}
            </TableBody>
          </Table>
        )}
        {apiRequests.length > 0 && (
          <LoadMoreRows
            shownCount={apiRequests.length}
            totalCount={totalCount}
            hasNextPage={requestsQuery.hasNextPage}
            isFetchingNextPage={requestsQuery.isFetchingNextPage}
            onLoadMore={loadNextPage}
          />
        )}
      </div>
    </div>
  );
}
