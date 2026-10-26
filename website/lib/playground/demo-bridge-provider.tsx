"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { basePath } from "@/lib/base-path";

import {
  isBridgeMessage,
  type PlaygroundEvent,
  type PlaygroundRequest,
  type PlaygroundResponse,
  readBridgeUrl,
} from "./bridge-messages";

type DemoBridge = {
  isReady: boolean;
  sendRequest: (
    playgroundRequest: PlaygroundRequest,
  ) => Promise<PlaygroundResponse>;
  /** Events the mock API published, newest last. */
  events: PlaygroundEvent[];
  clearEvents: () => void;
};

const DemoBridgeContext = createContext<DemoBridge | null>(null);

/** Keeps the hidden bridge iframe and routes requests, answers and events. */
export function DemoBridgeProvider({ children }: { children: ReactNode }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const pendingRequests = useRef(
    new Map<string, (response: PlaygroundResponse) => void>(),
  );
  const [isReady, setIsReady] = useState(false);
  // The bridge says "ready" once; it loads only after we listen, or a slow
  // hydration (the dev server, a slow phone) misses it and never sends.
  const [isListening, setIsListening] = useState(false);
  const [events, setEvents] = useState<PlaygroundEvent[]>([]);
  const bridgeUrl = readBridgeUrl(basePath);

  useEffect(() => {
    const bridgeOrigin = new URL(bridgeUrl, window.location.href).origin;
    const handleMessage = (messageEvent: MessageEvent) => {
      if (
        messageEvent.origin !== bridgeOrigin ||
        !isBridgeMessage(messageEvent.data)
      ) {
        return;
      }
      const bridgeMessage = messageEvent.data;
      if (bridgeMessage.kind === "ready") {
        setIsReady(true);
      } else if (bridgeMessage.kind === "event") {
        setEvents((previousEvents) => [
          ...previousEvents.slice(-99),
          bridgeMessage.event,
        ]);
      } else {
        const {
          requestId,
          source: _source,
          kind: _kind,
          ...response
        } = bridgeMessage;
        pendingRequests.current.get(requestId)?.(response);
        pendingRequests.current.delete(requestId);
      }
    };
    window.addEventListener("message", handleMessage);
    setIsListening(true);
    return () => window.removeEventListener("message", handleMessage);
  }, [bridgeUrl]);

  const sendRequest = useCallback(
    (playgroundRequest: PlaygroundRequest) =>
      new Promise<PlaygroundResponse>((resolve) => {
        const requestId = crypto.randomUUID();
        pendingRequests.current.set(requestId, resolve);
        iframeRef.current?.contentWindow?.postMessage(
          {
            source: "sendmock-playground",
            kind: "request",
            requestId,
            ...playgroundRequest,
          },
          new URL(bridgeUrl, window.location.href).origin,
        );
      }),
    [bridgeUrl],
  );
  const clearEvents = useCallback(() => setEvents([]), []);
  const demoBridge = useMemo(
    () => ({ isReady, sendRequest, events, clearEvents }),
    [isReady, sendRequest, events, clearEvents],
  );

  return (
    <DemoBridgeContext.Provider value={demoBridge}>
      {children}
      {isListening && (
        <iframe
          ref={iframeRef}
          src={bridgeUrl}
          title="SendMock demo API"
          aria-hidden="true"
          tabIndex={-1}
          className="hidden"
        />
      )}
    </DemoBridgeContext.Provider>
  );
}

export function useDemoBridge(): DemoBridge {
  const demoBridge = useContext(DemoBridgeContext);
  if (demoBridge === null) {
    throw new Error("useDemoBridge needs a DemoBridgeProvider");
  }
  return demoBridge;
}
