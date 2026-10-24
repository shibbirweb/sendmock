import type { MockDataSize } from "@/mocks/db/mock-database";

export type SimulatedApiError = "none" | "server-error" | "not-found";

/** Knobs of the dev toolbar that change how the mock API behaves. */
export type MockConditions = {
  latencyMs: number;
  simulatedApiError: SimulatedApiError;
  dataSize: MockDataSize;
  isRealtimeEnabled: boolean;
  realtimeIntervalMs: number;
};

type MockConditionsListener = (mockConditions: MockConditions) => void;

const defaultMockConditions: MockConditions = {
  latencyMs: 150,
  simulatedApiError: "none",
  dataSize: "standard",
  isRealtimeEnabled: true,
  realtimeIntervalMs: 12_000,
};

let currentMockConditions: MockConditions = defaultMockConditions;
const mockConditionsListeners = new Set<MockConditionsListener>();

export function readMockConditions(): MockConditions {
  return currentMockConditions;
}

export function updateMockConditions(
  conditionsUpdate: Partial<MockConditions>,
) {
  currentMockConditions = { ...currentMockConditions, ...conditionsUpdate };

  for (const mockConditionsListener of mockConditionsListeners) {
    mockConditionsListener(currentMockConditions);
  }
}

export function subscribeToMockConditions(
  mockConditionsListener: MockConditionsListener,
): () => void {
  mockConditionsListeners.add(mockConditionsListener);

  return () => {
    mockConditionsListeners.delete(mockConditionsListener);
  };
}
