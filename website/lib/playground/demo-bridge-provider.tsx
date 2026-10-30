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
import {
  connectToInstance,
  describeConnectionProblem,
  type PlaygroundTarget,
  sendToInstance,
} from "./local-instance";
import { useInstanceEvents } from "./use-instance-events";

/** The state of a connection to a real SendMock (Local or Custom URL mode). */
export type InstanceConnection =
  | { status: "idle" }
  | { status: "connecting" }
  | { status: "connected"; version: string }
  | { status: "failed"; explanation: string };

type DemoBridge = {
  isReady: boolean;
  sendRequest: (
    playgroundRequest: PlaygroundRequest,
  ) => Promise<PlaygroundResponse>;
  /** Events the target published, newest last. */
  events: PlaygroundEvent[];
  clearEvents: () => void;
  target: PlaygroundTarget;
  instanceConnection: InstanceConnection;
  /** Asks the SendMock at the URL for /info; nothing is sent to it before this (WS-05.2). */
  connectInstance: (baseUrl: string, apiToken: string | null) => Promise<void>;
  selectDemoTarget: () => void;
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

  const [target, setTarget] = useState<PlaygroundTarget>({ kind: "demo" });
  const [instanceConnection, setInstanceConnection] =
    useState<InstanceConnection>({ status: "idle" });
  const instanceEvents = useInstanceEvents(
    target.kind === "instance" && instanceConnection.status === "connected"
      ? target
      : null,
  );
  const connectInstance = useCallback(
    async (baseUrl: string, apiToken: string | null) => {
      setInstanceConnection({ status: "connecting" });
      const outcome = await connectToInstance(baseUrl, apiToken);
      if (outcome.kind === "connected") {
        setTarget({ kind: "instance", baseUrl, apiToken });
        setInstanceConnection({
          status: "connected",
          version: outcome.version,
        });
        return;
      }
      setTarget({ kind: "demo" });
      setInstanceConnection({
        status: "failed",
        explanation: describeConnectionProblem(outcome.problem, baseUrl),
      });
    },
    [],
  );
  const selectDemoTarget = useCallback(() => {
    setTarget({ kind: "demo" });
    setInstanceConnection({ status: "idle" });
  }, []);

  const sendBridgeRequest = useCallback(
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
  const sendRequest = useCallback(
    (playgroundRequest: PlaygroundRequest) =>
      target.kind === "instance"
        ? sendToInstance(target.baseUrl, target.apiToken, playgroundRequest)
        : sendBridgeRequest(playgroundRequest),
    [target, sendBridgeRequest],
  );
  const clearEvents = useCallback(() => setEvents([]), []);
  const demoBridge = useMemo(
    () => ({
      isReady:
        target.kind === "demo"
          ? isReady
          : instanceConnection.status === "connected",
      sendRequest,
      events: target.kind === "demo" ? events : instanceEvents,
      clearEvents,
      target,
      instanceConnection,
      connectInstance,
      selectDemoTarget,
    }),
    [
      isReady,
      sendRequest,
      events,
      instanceEvents,
      clearEvents,
      target,
      instanceConnection,
      connectInstance,
      selectDemoTarget,
    ],
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
