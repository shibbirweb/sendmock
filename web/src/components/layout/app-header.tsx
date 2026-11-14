import { useRouterState } from "@tanstack/react-router";
import { BookOpenIcon, KeyboardIcon, SearchIcon } from "lucide-react";
import * as React from "react";

import { IconButton, IconTooltip } from "@/components/common/icon-button";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  listAllNavigationItems,
  type NavigationItem,
} from "@/features/navigation/navigation-items";
import { documentationUrl } from "@/lib/community/community-links";
import { useAppOverlays } from "@/features/shortcuts/app-overlays-provider";
import { appShortcuts } from "@/features/shortcuts/shortcut-catalog";
import { HelpMenu } from "@/features/help/help-menu";
import { NotificationBell } from "@/features/notifications/notification-bell";
import { ProjectSwitcher } from "@/features/projects/project-switcher";
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

/** Screens that are not in the sidebar, opened from the Help menu. */
const titlesOfScreensOutsideSidebar: Record<string, string> = {
  "/api-reference": "API reference",
};

/** The sidebar item for the open screen; undefined on an unknown path. */
function findCurrentNavigationItem(
  currentPath: string,
): NavigationItem | undefined {
  return listAllNavigationItems()
    .filter(
      (navigationItem) =>
        currentPath === navigationItem.path ||
        (navigationItem.path !== "/" &&
          currentPath.startsWith(`${navigationItem.path}/`)),
    )
    .sort(
      (firstItem, secondItem) => secondItem.path.length - firstItem.path.length,
    )[0];
}

/** A book icon next to the page title that opens this screen's guide page. */
function PageGuideLink({ navigationItem }: { navigationItem: NavigationItem }) {
  const guideLabel = `Read the ${navigationItem.title} guide`;

  return (
    <IconButton
      label={guideLabel}
      variant="ghost"
      size="icon-sm"
      className="shrink-0 text-muted-foreground hover:text-foreground"
      asChild
    >
      <a
        href={`${documentationUrl}${navigationItem.docsPath}`}
        target="_blank"
        rel="noreferrer"
      >
        <BookOpenIcon />
      </a>
    </IconButton>
  );
}

export function AppHeader() {
  const currentPath = useRouterState({
    select: (routerState) => routerState.location.pathname,
  });
  const { setCommandPaletteOpen, setShortcutHelpOpen } = useAppOverlays();
  const currentNavigationItem = findCurrentNavigationItem(currentPath);

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
      <IconTooltip
        label="Toggle Sidebar"
        shortcutKeys={appShortcuts.toggleSidebar.keys}
      >
        <SidebarTrigger aria-label="Toggle Sidebar" />
      </IconTooltip>
      <Separator orientation="vertical" className="mx-1 h-4" />
      <h1 className="min-w-0 truncate text-sm font-medium">
        {currentNavigationItem?.title ??
          titlesOfScreensOutsideSidebar[currentPath] ??
          "Not found"}
      </h1>
      {currentNavigationItem !== undefined && (
        <PageGuideLink navigationItem={currentNavigationItem} />
      )}
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <ProjectSwitcher />
        {/* The wide search button needs a laptop width next to the sidebar. */}
        <Button
          variant="outline"
          size="sm"
          className="hidden gap-2 text-muted-foreground lg:flex"
          onClick={() => {
            setCommandPaletteOpen(true);
          }}
        >
          <SearchIcon />
          Search or jump to...
          <Kbd>⌘K</Kbd>
        </Button>
        <IconButton
          variant="ghost"
          label="Search or jump to"
          className="lg:hidden"
          onClick={() => {
            setCommandPaletteOpen(true);
          }}
        >
          <SearchIcon />
        </IconButton>
        {LazyDevToolbar !== null && (
          <React.Suspense fallback={null}>
            <LazyDevToolbar />
          </React.Suspense>
        )}
        <IconButton
          variant="ghost"
          label="Keyboard shortcuts"
          shortcutKeys={appShortcuts.showShortcuts.keys}
          onClick={() => {
            setShortcutHelpOpen(true);
          }}
        >
          <KeyboardIcon />
        </IconButton>
        <HelpMenu />
        <ThemeToggle />
        <NotificationBell />
      </div>
    </header>
  );
}
