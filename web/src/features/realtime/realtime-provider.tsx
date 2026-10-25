import { useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import { buildRealtimeUrl } from "@/lib/api/api-client";
import type { AppEvent } from "@/lib/api/types";
import { readNotificationPreferences } from "@/features/notifications/notification-preferences";
import { addNotification } from "@/features/notifications/notification-store";
import {
  describeEventForNotification,
  listQueryKeysToRefresh,
} from "@/features/realtime/realtime-event-effects";
import { toast } from "sonner";

export type RealtimeConnectionState =
  "connecting" | "connected" | "disconnected";

const RealtimeConnectionContext =
  React.createContext<RealtimeConnectionState>("connecting");

type AppEventListener = (appEvent: AppEvent) => void;

/** Lets features react to events (e.g. browser notifications for new mail). */
const appEventListeners = new Set<AppEventListener>();

const reconnectDelayMs = 3000;

/**
 * Keeps one WebSocket to /api/v1/ws open, refreshes the affected queries on
 * every event and reconnects after a short delay when the stream drops.
 */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [connectionState, setConnectionState] =
    React.useState<RealtimeConnectionState>("connecting");

  React.useEffect(() => {
    let realtimeSocket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let isUnmounted = false;

    const handleAppEvent = (appEvent: AppEvent) => {
      for (const queryKey of listQueryKeysToRefresh(appEvent.type)) {
        void queryClient.invalidateQueries({ queryKey });
      }

      for (const appEventListener of appEventListeners) {
        appEventListener(appEvent);
      }

      // Every notable event goes to the bell; a toast only when toasts are on (UI-08).
      const eventNotification = describeEventForNotification(appEvent);
      if (eventNotification !== null) {
        addNotification({
          ...eventNotification,
          id: appEvent.id,
          createdAt: appEvent.created_at,
        });
        if (readNotificationPreferences().areToastsShown) {
          toast(eventNotification.title, {
            description: eventNotification.description,
          });
        }
      }
    };

    const connect = () => {
      setConnectionState("connecting");
      realtimeSocket = new WebSocket(buildRealtimeUrl());

      realtimeSocket.addEventListener("open", () => {
        setConnectionState("connected");
      });
      realtimeSocket.addEventListener("message", (messageEvent) => {
        try {
          handleAppEvent(JSON.parse(String(messageEvent.data)) as AppEvent);
        } catch {
          // Ignore frames that are not app events.
        }
      });
      realtimeSocket.addEventListener("close", () => {
        setConnectionState("disconnected");
        if (!isUnmounted) {
          reconnectTimer = setTimeout(connect, reconnectDelayMs);
        }
      });
    };

    connect();

    return () => {
      isUnmounted = true;
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
      }
      realtimeSocket?.close();
    };
  }, [queryClient]);

  return (
    <RealtimeConnectionContext.Provider value={connectionState}>
      {children}
    </RealtimeConnectionContext.Provider>
  );
}

export function useRealtimeConnectionState(): RealtimeConnectionState {
  return React.useContext(RealtimeConnectionContext);
}

/** Calls the listener for every realtime event while the component is mounted. */
export function useAppEventListener(appEventListener: AppEventListener) {
  const latestListenerRef = React.useRef(appEventListener);

  React.useEffect(() => {
    latestListenerRef.current = appEventListener;
  });

  React.useEffect(() => {
    const forwardAppEvent: AppEventListener = (appEvent) => {
      latestListenerRef.current(appEvent);
    };
    appEventListeners.add(forwardAppEvent);

    return () => {
      appEventListeners.delete(forwardAppEvent);
    };
  }, []);
}
