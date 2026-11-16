import type { MockDatabase } from "@/mocks/db/mock-database";
import { isDeliveryInFlight } from "@/mocks/webhooks/is-delivery-in-flight";

/**
 * Deletes every captured item in every project and keeps the configuration
 * (`DELETE /api/v1/traffic`); answers how many items went.
 */
export function deleteAllTraffic(mockDatabase: MockDatabase): number {
  const keptDeliveries =
    mockDatabase.webhookDeliveries.filter(isDeliveryInFlight);
  const deletedCount =
    mockDatabase.emails.length +
    mockDatabase.smsMessages.length +
    mockDatabase.verifications.length +
    mockDatabase.pushNotifications.length +
    mockDatabase.capturedHttpRequests.length +
    (mockDatabase.webhookDeliveries.length - keptDeliveries.length) +
    mockDatabase.payments.length +
    mockDatabase.paymentSubscriptions.length +
    mockDatabase.smtpSessions.length +
    mockDatabase.apiRequestLog.length;

  mockDatabase.emails = [];
  mockDatabase.emailTimelines.clear();
  mockDatabase.messageOpens.clear();
  mockDatabase.emailClicks.clear();
  mockDatabase.attachmentContents.clear();
  mockDatabase.smsMediaContents.clear();
  mockDatabase.smsMessages = [];
  mockDatabase.verifications = [];
  mockDatabase.pushNotifications = [];
  mockDatabase.capturedHttpRequests = [];
  mockDatabase.httpFileContents.clear();
  for (const httpBin of mockDatabase.httpBins) {
    httpBin.request_count = 0;
    httpBin.last_request_at = null;
  }
  mockDatabase.webhookDeliveries = keptDeliveries;
  mockDatabase.payments = [];
  mockDatabase.paymentSubscriptions = [];
  mockDatabase.smtpSessions = [];
  mockDatabase.apiRequestLog = [];

  return deletedCount;
}
