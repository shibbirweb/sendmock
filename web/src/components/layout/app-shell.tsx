import { Outlet, useRouterState } from "@tanstack/react-router";

import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
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
      <AppSidebar />
      {/* A fixed-height inset lets screens like Mail scroll their own panes. */}
      <SidebarInset className="h-svh overflow-hidden">
        <AppHeader />
        <main className="flex min-h-0 flex-1 flex-col overflow-auto">
          <Outlet />
        </main>
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

  return isStandalonePath(pathname) ? <Outlet /> : <AppFrame />;
}
