// What each feature is (summary) and what it lets a developer do (intended outcome).
import { messagingFeatureSummaries } from "./feature-summaries-messaging";
import { providerAppFeatureSummaries } from "./feature-summaries-provider-apps";
import { storageFeatureSummaries } from "./feature-summaries-storage";
import { toolFeatureSummaries } from "./feature-summaries-tools";

export type FeatureSummary = { summary: string; outcome: string };

export const featureSummaries: Record<string, FeatureSummary> = {
  ...messagingFeatureSummaries,
  ...toolFeatureSummaries,
  ...storageFeatureSummaries,
  ...providerAppFeatureSummaries,
};
