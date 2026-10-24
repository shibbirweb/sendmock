import { useSidebar } from "@/components/ui/sidebar";
import { apiMode } from "@/config/api-mode";
import {
  type RealtimeConnectionState,
  useRealtimeConnectionState,
} from "@/features/realtime/realtime-provider";
import { cn } from "@/lib/utils";

const appVersion = import.meta.env.VITE_APP_VERSION ?? "0.0.0-dev";

const connectionLabels: Record<RealtimeConnectionState, string> = {
  connecting: "Connecting",
  connected: "Live",
  disconnected: "Offline, retrying",
};

const connectionDotClasses: Record<RealtimeConnectionState, string> = {
  connecting: "bg-amber-500",
  connected: "bg-emerald-500",
  disconnected: "bg-destructive",
};

/** Sidebar footer: realtime connection state, data source and app version. */
export function ConnectionStatus() {
  const { state: sidebarState } = useSidebar();
  const connectionState = useRealtimeConnectionState();
  const isSidebarCollapsed = sidebarState === "collapsed";
  const dataSourceLabel = apiMode === "mock" ? "demo data" : "server";
  const connectionLabel = `${connectionLabels[connectionState]} · ${dataSourceLabel}`;

  return (
    <div
      className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground"
      title={`${connectionLabel}, version ${appVersion}`}
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
          <span>v{appVersion}</span>
        </span>
      )}
    </div>
  );
}
