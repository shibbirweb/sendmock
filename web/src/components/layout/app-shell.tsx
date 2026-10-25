import { Outlet } from "@tanstack/react-router";

import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { CommandPalette } from "@/features/command-palette/command-palette";
import { ShortcutHelpDialog } from "@/features/shortcuts/shortcut-help-dialog";
import { useGlobalShortcuts } from "@/features/shortcuts/use-global-shortcuts";

/** Sidebar, header and the routed page, plus the app-wide overlays. */
export function AppShell() {
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
