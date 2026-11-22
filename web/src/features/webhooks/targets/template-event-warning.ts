import type {
  AppEventType,
  WebhookEndpoint,
  WebhookTemplateSummary,
} from "@/lib/api/types";

/**
 * Why an endpoint may send the wrong shape for the event: its template does not list it, as
 * an inbound template chosen for a bounce (EM-25.5). Null when the template lists the event,
 * when the template lists no events (it takes any), or when it is not known yet.
 */
export function findTemplateEventWarning(
  webhookEndpoint: WebhookEndpoint,
  webhookTemplates: WebhookTemplateSummary[],
  eventType: AppEventType,
): string | null {
  const endpointTemplate = webhookTemplates.find(
    (webhookTemplate) => webhookTemplate.id === webhookEndpoint.template_id,
  );
  if (
    endpointTemplate === undefined ||
    endpointTemplate.events.length === 0 ||
    endpointTemplate.events.includes(eventType)
  ) {
    return null;
  }
  return `Its template, ${endpointTemplate.name}, is not made for ${eventType}; your app may not read what it sends.`;
}
