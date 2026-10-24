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
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { ConnectionStatus } from "@/features/connection/connection-status";
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

export function AppSidebar() {
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
                  <span className="font-semibold">mss</span>
                  <span className="text-xs text-muted-foreground">
                    Mail, SMS and webhooks
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
