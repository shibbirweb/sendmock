import { useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import { buildRealtimeUrl } from "@/lib/api/api-client";
import type { AppEvent } from "@/lib/api/types";
import {
  announceRealtimeEvents,
  createToastLimiter,
} from "@/features/realtime/announce-realtime-events";
import {
  applyRealtimeEvents,
  refreshAfterReconnect,
} from "@/features/realtime/apply-realtime-events";
import { createQueryRefresher } from "@/features/realtime/query-refresher";
import { createRealtimeEventBatcher } from "@/features/realtime/realtime-event-batcher";

export type RealtimeConnectionState =
  "connecting" | "connected" | "disconnected";

const RealtimeConnectionContext =
  React.createContext<RealtimeConnectionState>("connecting");

type AppEventListener = (appEvent: AppEvent) => void;

/** Lets features react to events (e.g. browser notifications for new mail). */
const appEventListeners = new Set<AppEventListener>();

const reconnectDelayMs = 3000;

function parseAppEvent(frameText: string): AppEvent | null {
  try {
    return JSON.parse(frameText) as AppEvent;
  } catch {
    return null;
  }
}

/**
 * Keeps one WebSocket to /api/v1/ws open and applies its events in batches (PL-02.3): new
 * emails go straight into the cached lists, other queries refresh once per batch, and toasts
 * are limited. After a dropped stream it reconnects and refreshes every list once (PL-02.5).
 */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [connectionState, setConnectionState] =
    React.useState<RealtimeConnectionState>("connecting");

  React.useEffect(() => {
    let realtimeSocket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let isUnmounted = false;
    let hasConnectedBefore = false;
    const queryRefresher = createQueryRefresher(queryClient);
    const toastLimiter = createToastLimiter();
    const eventBatcher = createRealtimeEventBatcher((queuedEvents) => {
      applyRealtimeEvents(queryClient, queryRefresher, queuedEvents);
      for (const queuedEvent of queuedEvents) {
        for (const appEventListener of appEventListeners) {
          appEventListener(queuedEvent);
        }
      }
      announceRealtimeEvents(queuedEvents, toastLimiter);
    });

    const connect = () => {
      setConnectionState("connecting");
      realtimeSocket = new WebSocket(buildRealtimeUrl());

      realtimeSocket.addEventListener("open", () => {
        setConnectionState("connected");
        if (hasConnectedBefore) {
          refreshAfterReconnect(queryRefresher);
        }
        hasConnectedBefore = true;
      });
      realtimeSocket.addEventListener("message", (messageEvent) => {
        const appEvent = parseAppEvent(String(messageEvent.data));
        if (appEvent !== null) {
          eventBatcher.addEvent(appEvent);
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
      eventBatcher.dispose();
      toastLimiter.dispose();
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
