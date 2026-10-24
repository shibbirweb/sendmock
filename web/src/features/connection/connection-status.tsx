import { useSidebar } from "@/components/ui/sidebar";
import { apiMode } from "@/config/api-mode";
import { cn } from "@/lib/utils";

const appVersion = import.meta.env.VITE_APP_VERSION ?? "0.0.0-dev";

/**
 * Live connection indicator for the sidebar footer. Until the realtime client
 * exists it reports the API mode; the dot turns green once events stream.
 */
export function ConnectionStatus() {
  const { state: sidebarState } = useSidebar();
  const isSidebarCollapsed = sidebarState === "collapsed";
  const connectionLabel = apiMode === "mock" ? "Demo data" : "Live";

  return (
    <div
      className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground"
      title={`${connectionLabel}, version ${appVersion}`}
    >
      <span
        aria-hidden
        className={cn(
          "size-2 shrink-0 rounded-full",
          apiMode === "mock" ? "bg-amber-500" : "bg-emerald-500",
        )}
      />
      {!isSidebarCollapsed && (
        <span className="flex w-full justify-between">
          <span>{connectionLabel}</span>
          <span>v{appVersion}</span>
        </span>
      )}
    </div>
  );
}
