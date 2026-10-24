import { Link, useRouterState } from "@tanstack/react-router";
import { InboxIcon } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { ConnectionStatus } from "@/features/connection/connection-status";
import { useAppStats } from "@/lib/api/hooks/use-system-queries";
import type { AppStats } from "@/lib/api/types";
import {
  type NavigationItem,
  navigationItems,
} from "@/features/navigation/navigation-items";

function isPathActive(currentPath: string, itemPath: string): boolean {
  if (itemPath === "/") {
    return currentPath === "/";
  }

  return currentPath === itemPath || currentPath.startsWith(`${itemPath}/`);
}

function isSectionActive(currentPath: string, navigationItem: NavigationItem) {
  const sectionPrefix = navigationItem.path.split("/").slice(0, 2).join("/");

  return isPathActive(currentPath, sectionPrefix || "/");
}

/** Unread counters shown next to sidebar sections. */
function readSectionBadgeCount(
  sectionPath: string,
  appStats: AppStats | undefined,
): number {
  if (sectionPath === "/mail") {
    return appStats?.unread_email_count ?? 0;
  }

  if (sectionPath === "/sms") {
    return appStats?.unread_sms_count ?? 0;
  }

  return 0;
}

export function AppSidebar() {
  const { data: appStats } = useAppStats();
  const currentPath = useRouterState({
    select: (routerState) => routerState.location.pathname,
  });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/">
                <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <InboxIcon className="size-4" />
                </span>
                <span className="grid leading-tight">
                  <span className="font-semibold">SendMock</span>
                  <span className="text-xs text-muted-foreground">
                    Mail · SMS · Payments
                  </span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((navigationItem) => (
                <SidebarMenuItem key={navigationItem.title}>
                  <SidebarMenuButton
                    asChild
                    tooltip={navigationItem.title}
                    isActive={isSectionActive(currentPath, navigationItem)}
                  >
                    <Link to={navigationItem.path}>
                      <navigationItem.icon />
                      <span>{navigationItem.title}</span>
                    </Link>
                  </SidebarMenuButton>
                  {readSectionBadgeCount(navigationItem.path, appStats) > 0 && (
                    <SidebarMenuBadge>
                      {readSectionBadgeCount(navigationItem.path, appStats)}
                    </SidebarMenuBadge>
                  )}
                  {navigationItem.children !== undefined &&
                    isSectionActive(currentPath, navigationItem) && (
                      <SidebarMenuSub>
                        {navigationItem.children.map((childItem) => (
                          <SidebarMenuSubItem key={childItem.title}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={isPathActive(
                                currentPath,
                                childItem.path,
                              )}
                            >
                              <Link to={childItem.path}>
                                <childItem.icon />
                                <span>{childItem.title}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <ConnectionStatus />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
