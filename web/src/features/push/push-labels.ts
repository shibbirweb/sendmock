import type { PushProvider, PushStatus } from "@/lib/api/types";

export const pushProviderLabels: Record<PushProvider, string> = {
  fcm: "FCM",
  expo: "Expo",
  onesignal: "OneSignal",
};

export const pushStatusLabels: Record<PushStatus, string> = {
  sent: "Sent",
  failed: "Failed",
};

export const pushProviders: PushProvider[] = ["fcm", "expo", "onesignal"];
export const pushStatuses: PushStatus[] = ["sent", "failed"];
