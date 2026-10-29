import { Outlet, useRouterState } from "@tanstack/react-router";

import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { ScreenAvailabilityGate } from "@/features/availability/screen-availability-gate";
import { CommandPalette } from "@/features/command-palette/command-palette";
import { ShortcutHelpDialog } from "@/features/shortcuts/shortcut-help-dialog";
import { useGlobalShortcuts } from "@/features/shortcuts/use-global-shortcuts";

/** Pages a customer sees, like the test checkout, stand alone without the app around them. */
function isStandalonePath(pathname: string): boolean {
  return pathname.startsWith("/pay/");
}

function AppFrame() {
  useGlobalShortcuts();

  return (
    <SidebarProvider>
      {/* The first tab stop: jumps past the sidebar and header (UI-05.1). */}
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-background px-3 py-2 text-sm font-medium shadow focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:ring-2 focus:ring-ring"
      >
        Skip to content
      </a>
      <AppSidebar />
      {/* A fixed-height inset lets screens like Mail scroll their own panes. */}
      <SidebarInset className="h-svh overflow-hidden">
        <AppHeader />
        {/* SidebarInset is the page's <main>; this is where the skip link lands. */}
        <div
          id="main-content"
          tabIndex={-1}
          className="flex min-h-0 flex-1 flex-col overflow-auto outline-none"
        >
          <ScreenAvailabilityGate>
            <Outlet />
          </ScreenAvailabilityGate>
        </div>
      </SidebarInset>
      <CommandPalette />
      <ShortcutHelpDialog />
    </SidebarProvider>
  );
}

/** Sidebar, header and the routed page, plus the app-wide overlays. */
export function AppShell() {
  const pathname = useRouterState({
    select: (routerState) => routerState.location.pathname,
  });

  return isStandalonePath(pathname) ? (
    <ScreenAvailabilityGate>
      <Outlet />
    </ScreenAvailabilityGate>
  ) : (
    <AppFrame />
  );
}
