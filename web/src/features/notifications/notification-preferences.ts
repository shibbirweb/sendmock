import * as React from "react";

export type ToastPosition =
  | "top-right"
  | "top-center"
  | "top-left"
  | "bottom-right"
  | "bottom-center"
  | "bottom-left";

/** How notifications are announced (UI-08); a per-browser preference, like the theme. */
export type NotificationPreferences = {
  areToastsShown: boolean;
  toastPosition: ToastPosition;
};

const preferencesStorageKey = "sendmock.notification-preferences";

const defaultPreferences: NotificationPreferences = {
  areToastsShown: true,
  toastPosition: "top-right",
};

const toastPositions: ToastPosition[] = [
  "top-right",
  "top-center",
  "top-left",
  "bottom-right",
  "bottom-center",
  "bottom-left",
];

function readStoredPreferences(): NotificationPreferences {
  try {
    const storedText = localStorage.getItem(preferencesStorageKey);
    const storedValue =
      storedText === null
        ? {}
        : (JSON.parse(storedText) as Partial<NotificationPreferences>);

    return {
      areToastsShown:
        typeof storedValue.areToastsShown === "boolean"
          ? storedValue.areToastsShown
          : defaultPreferences.areToastsShown,
      toastPosition: toastPositions.includes(
        storedValue.toastPosition as ToastPosition,
      )
        ? (storedValue.toastPosition as ToastPosition)
        : defaultPreferences.toastPosition,
    };
  } catch {
    return defaultPreferences;
  }
}

let currentPreferences = readStoredPreferences();
const preferenceListeners = new Set<() => void>();

export function readNotificationPreferences(): NotificationPreferences {
  return currentPreferences;
}

export function updateNotificationPreferences(
  changedPreferences: Partial<NotificationPreferences>,
) {
  currentPreferences = { ...currentPreferences, ...changedPreferences };
  try {
    localStorage.setItem(
      preferencesStorageKey,
      JSON.stringify(currentPreferences),
    );
  } catch {
    // Private windows may refuse storage; the choice lasts for this tab.
  }
  for (const preferenceListener of preferenceListeners) {
    preferenceListener();
  }
}

function subscribeToPreferences(preferenceListener: () => void) {
  preferenceListeners.add(preferenceListener);

  return () => {
    preferenceListeners.delete(preferenceListener);
  };
}

export function useNotificationPreferences(): NotificationPreferences {
  return React.useSyncExternalStore(
    subscribeToPreferences,
    readNotificationPreferences,
  );
}
