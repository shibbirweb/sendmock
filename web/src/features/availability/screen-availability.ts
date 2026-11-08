import {
  type NavigationItem,
  listAllNavigationItems,
} from "@/features/navigation/navigation-items";

export type ScreenAvailability = Pick<
  NavigationItem,
  "title" | "path" | "listOperationKey" | "upcomingDescription"
>;

/** The customer-facing checkout page has no sidebar item but arrives with Payments. */
const checkoutScreen: ScreenAvailability = {
  title: "The test checkout",
  path: "/pay",
  listOperationKey: "GET /api/v1/checkout-sessions/{sessionId}",
  upcomingDescription:
    "The hosted checkout page your app redirects customers to, with test cards.",
};

/** The screen a path belongs to: the longest matching path, so /mail/providers is not Mail. */
export function findScreenForPath(
  pathname: string,
): ScreenAvailability | undefined {
  const screens: ScreenAvailability[] = [
    ...listAllNavigationItems(),
    checkoutScreen,
  ];

  return screens
    .filter((screen) =>
      screen.path === "/"
        ? pathname === "/"
        : pathname === screen.path || pathname.startsWith(`${screen.path}/`),
    )
    .sort(
      (firstScreen, secondScreen) =>
        secondScreen.path.length - firstScreen.path.length,
    )[0];
}
