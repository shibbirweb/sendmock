import * as React from "react";

import { useAppEventListener } from "@/features/realtime/realtime-provider";

const notificationsStorageKey = "sendmock.mail-notifications";

function readStoredPreference(): boolean {
  try {
    return localStorage.getItem(notificationsStorageKey) === "on";
  } catch {
    return false;
  }
}

function storePreference(isEnabled: boolean) {
  try {
    localStorage.setItem(notificationsStorageKey, isEnabled ? "on" : "off");
  } catch {
    // Not persisting is fine; the choice still applies to this tab.
  }
}

/**
 * Opt-in browser notifications for new emails (EM-16). Nothing is requested
 * or shown until the user turns them on.
 */
export function useMailNotifications() {
  const isSupported = typeof Notification !== "undefined";
  const [isEnabled, setIsEnabled] = React.useState(
    () =>
      isSupported &&
      readStoredPreference() &&
      Notification.permission === "granted",
  );

  useAppEventListener((appEvent) => {
    if (!isEnabled || appEvent.type !== "email.received") {
      return;
    }

    const subject = appEvent.data.subject;
    new Notification("New email", {
      body: typeof subject === "string" ? subject : "",
      tag: appEvent.id,
    });
  });

  const toggleNotifications = async () => {
    if (!isSupported) {
      return;
    }
    if (isEnabled) {
      setIsEnabled(false);
      storePreference(false);
      return;
    }

    const permission =
      Notification.permission === "granted"
        ? "granted"
        : await Notification.requestPermission();
    const isGranted = permission === "granted";
    setIsEnabled(isGranted);
    storePreference(isGranted);
  };

  return { isSupported, isEnabled, toggleNotifications };
}
