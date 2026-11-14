import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronRightIcon } from "lucide-react";
import * as React from "react";

import { SendMockLogo } from "@/components/common/sendmock-logo";
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
  useSidebar,
} from "@/components/ui/sidebar";
import { ConnectionStatus } from "@/features/connection/connection-status";
import {
  SidebarChildPhaseLabel,
  SidebarPhaseBadge,
} from "@/features/availability/sidebar-phase-badge";
import { SidebarCommunityLinks } from "@/features/help/sidebar-community-links";
import { cn } from "@/lib/utils";
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

/**
 * The child to highlight: the longest path that matches, so "All payments"
 * (/payments) is not lit while Methods (/payments/methods) is open.
 */
function findActiveChildPath(
  currentPath: string,
  childItems: NavigationItem[],
): string | undefined {
  return childItems
    .map((childItem) => childItem.path)
    .filter((childPath) => isPathActive(currentPath, childPath))
    .sort((firstPath, secondPath) => secondPath.length - firstPath.length)[0];
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
  const { setOpenMobile } = useSidebar();

  // On phones the sidebar is a drawer; close it once the user has navigated.
  React.useEffect(() => {
    setOpenMobile(false);
  }, [currentPath, setOpenMobile]);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/">
                {/* The ! overrides the menu button's size-4 rule for every svg inside it;
                    the collapsed icon rail only has room for size-8. */}
                <SendMockLogo className="size-10! shrink-0 group-data-[collapsible=icon]:size-8!" />
                {/* Hidden in icon mode so the logo keeps its square shape. */}
                <span className="grid leading-tight group-data-[collapsible=icon]:hidden">
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
            {/* gap-1 keeps hover and active backgrounds from touching. */}
            <SidebarMenu className="gap-1">
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
                      {navigationItem.children !== undefined && (
                        <ChevronRightIcon
                          aria-hidden="true"
                          data-testid="sidebar-group-chevron"
                          className={cn(
                            "ml-auto transition-transform",
                            isSectionActive(currentPath, navigationItem) &&
                              "rotate-90",
                          )}
                        />
                      )}
                    </Link>
                  </SidebarMenuButton>
                  <SidebarPhaseBadge
                    navigationItem={navigationItem}
                    className={cn(
                      navigationItem.children !== undefined && "right-7",
                    )}
                  />
                  {readSectionBadgeCount(navigationItem.path, appStats) > 0 && (
                    <SidebarMenuBadge
                      className={cn(
                        navigationItem.children !== undefined && "right-7",
                      )}
                    >
                      {readSectionBadgeCount(navigationItem.path, appStats)}
                    </SidebarMenuBadge>
                  )}
                  {navigationItem.children !== undefined &&
                    isSectionActive(currentPath, navigationItem) && (
                      <SidebarMenuSub className="mt-1">
                        {navigationItem.children.map((childItem) => (
                          <SidebarMenuSubItem key={childItem.title}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={
                                findActiveChildPath(
                                  currentPath,
                                  navigationItem.children ?? [],
                                ) === childItem.path
                              }
                            >
                              <Link to={childItem.path}>
                                <childItem.icon />
                                <span>{childItem.title}</span>
                                <SidebarChildPhaseLabel
                                  navigationItem={childItem}
                                />
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
        <SidebarCommunityLinks />
        <ConnectionStatus />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
