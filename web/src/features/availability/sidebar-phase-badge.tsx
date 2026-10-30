import { SidebarMenuBadge } from "@/components/ui/sidebar";
import type { NavigationItem } from "@/features/navigation/navigation-items";
import { useOperationAvailability } from "@/lib/api/hooks/use-operation-availability";
import { cn } from "@/lib/utils";

/** "Phase 2" beside a sidebar section the running SendMock does not serve yet (UI-12.2). */
export function SidebarPhaseBadge({
  navigationItem,
  className,
}: {
  navigationItem: NavigationItem;
  className?: string;
}) {
  const availability = useOperationAvailability(
    navigationItem.listOperationKey,
  );
  if (availability.isAvailable) {
    return null;
  }

  return (
    <SidebarMenuBadge className={cn("text-muted-foreground", className)}>
      Phase {availability.phase}
    </SidebarMenuBadge>
  );
}

/** The same note on a sub-item, inside its link. */
export function SidebarChildPhaseLabel({
  navigationItem,
}: {
  navigationItem: NavigationItem;
}) {
  const availability = useOperationAvailability(
    navigationItem.listOperationKey,
  );
  if (availability.isAvailable) {
    return null;
  }

  return (
    <span className="ml-auto text-xs text-muted-foreground">
      Phase {availability.phase}
    </span>
  );
}
