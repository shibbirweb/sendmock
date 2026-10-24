import { useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import { buildRealtimeUrl } from "@/lib/api/api-client";
import type { AppEvent } from "@/lib/api/types";
import {
  describeEventForToast,
  listQueryKeysToRefresh,
} from "@/features/realtime/realtime-event-effects";
import { toast } from "sonner";

export type RealtimeConnectionState =
  "connecting" | "connected" | "disconnected";

const RealtimeConnectionContext =
  React.createContext<RealtimeConnectionState>("connecting");

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

      const toastMessage = describeEventForToast(appEvent);
      if (toastMessage !== null) {
        toast(toastMessage.title, { description: toastMessage.description });
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
