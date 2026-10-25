import { useRouterState } from "@tanstack/react-router";
import { KeyboardIcon, SearchIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { listAllNavigationItems } from "@/features/navigation/navigation-items";
import { useAppOverlays } from "@/features/shortcuts/app-overlays-provider";
import { NotificationBell } from "@/features/notifications/notification-bell";
import { ThemeToggle } from "@/features/theme/theme-toggle";

/**
 * Demo controls, loaded only in mock mode. The import sits behind the
 * build-time flag so a live build drops it and the whole mock layer.
 */
const LazyDevToolbar =
  import.meta.env.VITE_API_MODE !== "live"
    ? React.lazy(async () => {
        const { DevToolbar } = await import("@/mocks/dev-toolbar/dev-toolbar");

        return { default: DevToolbar };
      })
    : null;

function findPageTitle(currentPath: string): string {
  const matchingItem = listAllNavigationItems()
    .filter(
      (navigationItem) =>
        currentPath === navigationItem.path ||
        (navigationItem.path !== "/" &&
          currentPath.startsWith(`${navigationItem.path}/`)),
    )
    .sort(
      (firstItem, secondItem) => secondItem.path.length - firstItem.path.length,
    )[0];

  return matchingItem?.title ?? "Not found";
}

export function AppHeader() {
  const currentPath = useRouterState({
    select: (routerState) => routerState.location.pathname,
  });
  const { setCommandPaletteOpen, setShortcutHelpOpen } = useAppOverlays();

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
      <SidebarTrigger />
      <Separator orientation="vertical" className="mx-1 h-4" />
      <h1 className="text-sm font-medium">{findPageTitle(currentPath)}</h1>
      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          className="hidden gap-2 text-muted-foreground sm:flex"
          onClick={() => {
            setCommandPaletteOpen(true);
          }}
        >
          <SearchIcon />
          Search or jump to...
          <Kbd>⌘K</Kbd>
        </Button>
        {LazyDevToolbar !== null && (
          <React.Suspense fallback={null}>
            <LazyDevToolbar />
          </React.Suspense>
        )}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Keyboard shortcuts"
          onClick={() => {
            setShortcutHelpOpen(true);
          }}
        >
          <KeyboardIcon />
        </Button>
        <ThemeToggle />
        <NotificationBell />
      </div>
    </header>
  );
}
