import { Link } from "@tanstack/react-router";
import {
  ArrowUpCircleIcon,
  BellIcon,
  MailIcon,
  MessageSquareIcon,
  WebhookIcon,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  type AppNotification,
  clearNotifications,
  markAllNotificationsRead,
  useNotifications,
} from "@/features/notifications/notification-store";
import { formatRelativeTime } from "@/lib/format/format-values";
import { cn } from "@/lib/utils";

const areaIcons = {
  email: MailIcon,
  sms: MessageSquareIcon,
  webhook: WebhookIcon,
  update: ArrowUpCircleIcon,
};

function NotificationLinkTarget({
  notification,
  className,
  onOpen,
  children,
}: {
  notification: AppNotification;
  className: string;
  onOpen: () => void;
  children: React.ReactNode;
}) {
  const notificationLink = notification.link;
  if (notificationLink?.kind === "email") {
    return (
      <Link
        to="/mail/$emailId"
        params={{ emailId: notificationLink.emailId }}
        className={className}
        onClick={onOpen}
      >
        {children}
      </Link>
    );
  }
  if (notificationLink?.kind === "sms") {
    return (
      <Link
        to="/sms/$threadId"
        params={{ threadId: notificationLink.threadId }}
        className={className}
        onClick={onOpen}
      >
        {children}
      </Link>
    );
  }
  if (notificationLink?.kind === "delivery") {
    return (
      <Link
        to="/webhooks/deliveries"
        search={{ delivery: notificationLink.deliveryId }}
        className={className}
        onClick={onOpen}
      >
        {children}
      </Link>
    );
  }
  if (notificationLink?.kind === "about") {
    return (
      <Link
        to="/settings"
        search={{ section: "about" }}
        className={className}
        onClick={onOpen}
      >
        {children}
      </Link>
    );
  }

  return <div className={className}>{children}</div>;
}

function NotificationItem({
  notification,
  wasUnread,
  onOpen,
}: {
  notification: AppNotification;
  wasUnread: boolean;
  onOpen: () => void;
}) {
  const AreaIcon = areaIcons[notification.area];

  return (
    <li>
      <NotificationLinkTarget
        notification={notification}
        onOpen={onOpen}
        className={cn(
          "flex gap-3 rounded-md px-2 py-2 text-left hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          wasUnread && "bg-muted/50",
        )}
      >
        <AreaIcon
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
        />
        <span className="grid min-w-0 flex-1 gap-0.5">
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate text-sm font-medium">
              {notification.title}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatRelativeTime(notification.createdAt)}
            </span>
          </span>
          {notification.description !== "" && (
            <span className="truncate text-xs text-muted-foreground">
              {notification.description}
            </span>
          )}
        </span>
        {wasUnread && <span className="sr-only">Unread</span>}
      </NotificationLinkTarget>
    </li>
  );
}

/**
 * The header bell (UI-08.2, UI-08.3): the unread count, and a list of the
 * latest notifications, newest first; opening it marks them read.
 */
export function NotificationBell() {
  const { notifications, unreadCount } = useNotifications();
  const [isOpen, setOpen] = React.useState(false);
  // Shown as unread while the list stays open, though already marked read.
  const [unreadIdsAtOpen, setUnreadIdsAtOpen] = React.useState<Set<string>>(
    new Set(),
  );
  const unreadLabel = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <Popover
      open={isOpen}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          setUnreadIdsAtOpen(
            new Set(
              notifications
                .filter((notification) => !notification.isRead)
                .map((notification) => notification.id),
            ),
          );
          markAllNotificationsRead();
          // The list shows them all; toasts would cover it.
          toast.dismiss();
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="relative"
          aria-label={
            unreadCount === 0
              ? "Notifications"
              : `Notifications, ${unreadCount} unread`
          }
        >
          <BellIcon />
          {unreadCount > 0 && (
            <span
              aria-hidden="true"
              className="absolute -top-0.5 -right-0.5 min-w-4 rounded-full bg-destructive px-1 text-[10px] leading-4 font-medium text-destructive-foreground"
              data-testid="notification-count"
            >
              {unreadLabel}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        aria-labelledby="notification-list-heading"
        className="w-96 max-w-[calc(100vw-2rem)] p-0"
      >
        <div className="flex items-center justify-between border-b px-3 py-2">
          <h2 id="notification-list-heading" className="text-sm font-semibold">
            Notifications
          </h2>
          <Button
            variant="ghost"
            size="sm"
            className="h-7"
            disabled={notifications.length === 0}
            onClick={clearNotifications}
          >
            Clear all
          </Button>
        </div>
        {notifications.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            No notifications yet. New emails, SMS and failed webhook deliveries
            show up here.
          </p>
        ) : (
          <ul
            aria-label="Notifications"
            className="grid max-h-96 gap-0.5 overflow-y-auto p-1"
          >
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                wasUnread={unreadIdsAtOpen.has(notification.id)}
                onOpen={() => setOpen(false)}
              />
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
