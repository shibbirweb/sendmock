import { useSidebar } from "@/components/ui/sidebar";
import { apiMode } from "@/config/api-mode";
import {
  type RealtimeConnectionState,
  useRealtimeConnectionState,
} from "@/features/realtime/realtime-provider";
import { useAppInfo } from "@/lib/api/hooks/use-system-queries";
import { cn } from "@/lib/utils";

const connectionLabels: Record<RealtimeConnectionState, string> = {
  connecting: "Connecting",
  connected: "Live",
  disconnected: "Offline, retrying",
};

const connectionDotClasses: Record<RealtimeConnectionState, string> = {
  connecting: "bg-warning",
  connected: "bg-success",
  disconnected: "bg-destructive",
};

/** Sidebar footer: realtime connection state, data source and the server's version. */
export function ConnectionStatus() {
  const { state: sidebarState } = useSidebar();
  const connectionState = useRealtimeConnectionState();
  // The running server's version, as Settings > About shows it; none until /info answers.
  const serverVersion = useAppInfo().data?.version ?? null;
  const isSidebarCollapsed = sidebarState === "collapsed";
  const dataSourceLabel = apiMode === "mock" ? "demo data" : "server";
  const connectionLabel = `${connectionLabels[connectionState]} · ${dataSourceLabel}`;

  return (
    <div
      className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground"
      title={
        serverVersion === null
          ? connectionLabel
          : `${connectionLabel}, version ${serverVersion}`
      }
      role="status"
    >
      <span
        aria-hidden
        className={cn(
          "size-2 shrink-0 rounded-full",
          connectionDotClasses[connectionState],
          connectionState === "connected" && "animate-pulse",
        )}
      />
      {!isSidebarCollapsed && (
        <span className="flex w-full justify-between gap-2">
          <span className="truncate">{connectionLabel}</span>
          {serverVersion !== null && <span>v{serverVersion}</span>}
        </span>
      )}
    </div>
  );
}
