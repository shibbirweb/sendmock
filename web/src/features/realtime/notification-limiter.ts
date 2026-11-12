/** At most one toast or browser notification this often, as Mailpit pauses its notifications. */
export const notificationIntervalMs = 2000;

export type NotificationLimiter<NotificationType> = {
  offerNotification: (notification: NotificationType) => void;
  dispose: () => void;
};

/**
 * Shows the first notification at once, then at most one per interval: the latest one that
 * arrived meanwhile, with how many others it stands for. None is lost when they come slowly;
 * a burst of thousands becomes one notification every interval.
 */
export function createNotificationLimiter<NotificationType>(
  showNotification: (
    notification: NotificationType,
    otherCount: number,
  ) => void,
  intervalMs: number = notificationIntervalMs,
): NotificationLimiter<NotificationType> {
  let intervalTimer: ReturnType<typeof setTimeout> | null = null;
  let latestHeldNotification: NotificationType | null = null;
  let heldCount = 0;

  const startInterval = () => {
    intervalTimer = setTimeout(endInterval, intervalMs);
  };

  function endInterval() {
    intervalTimer = null;
    if (latestHeldNotification === null) {
      return;
    }
    showNotification(latestHeldNotification, heldCount - 1);
    latestHeldNotification = null;
    heldCount = 0;
    startInterval();
  }

  return {
    offerNotification: (notification) => {
      if (intervalTimer === null) {
        showNotification(notification, 0);
        startInterval();
        return;
      }
      latestHeldNotification = notification;
      heldCount += 1;
    },
    dispose: () => {
      if (intervalTimer !== null) {
        clearTimeout(intervalTimer);
        intervalTimer = null;
      }
      latestHeldNotification = null;
      heldCount = 0;
    },
  };
}

/** "Order shipped (and 241 more)", or the text as it is when it stands for no others. */
export function describeWithOtherCount(
  text: string,
  otherCount: number,
): string {
  if (otherCount <= 0) {
    return text;
  }
  const countText = `and ${otherCount} more`;

  return text === "" ? countText : `${text} (${countText})`;
}
