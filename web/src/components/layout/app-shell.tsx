import { Outlet } from "@tanstack/react-router";
import * as React from "react";

import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { CommandPalette } from "@/features/command-palette/command-palette";
import { ShortcutHelpDialog } from "@/features/shortcuts/shortcut-help-dialog";
import { useGlobalShortcuts } from "@/features/shortcuts/use-global-shortcuts";
import { apiMode } from "@/config/api-mode";

/** Demo controls are loaded only in mock mode, so live builds never ship them. */
const LazyDevToolbar = React.lazy(async () => {
  const { DevToolbar } = await import("@/mocks/dev-toolbar/dev-toolbar");

  return { default: DevToolbar };
});

/** Sidebar, header and the routed page, plus the app-wide overlays. */
export function AppShell() {
  useGlobalShortcuts();

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-h-svh">
        <AppHeader />
        <main className="flex min-h-0 flex-1 flex-col">
          <Outlet />
        </main>
      </SidebarInset>
      <CommandPalette />
      <ShortcutHelpDialog />
      {apiMode === "mock" && (
        <React.Suspense fallback={null}>
          <LazyDevToolbar />
        </React.Suspense>
      )}
    </SidebarProvider>
  );
}
