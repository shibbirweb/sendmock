import { type SurfaceCatalogue } from "./surface-definition";

/** SMS, Verify, numbers and Messaging Services. */
export const smsSurfaces: SurfaceCatalogue = {
  "GET /api/v1/sms": {
    cli: "sendmock sms list",
    mcp: "sendmock_sms_list",
    ui: "SMS",
  },
  "DELETE /api/v1/sms": {
    cli: "sendmock sms delete-all --yes",
    mcp: "sendmock_sms_delete_all",
    ui: "Settings > General > Delete all SMS",
  },
  "POST /api/v1/sms": {
    cli: "sendmock sms send",
    mcp: "sendmock_sms_send",
    ui: "Settings > Connection > Send this request",
  },
  "GET /api/v1/sms/threads": {
    cli: "sendmock sms threads",
    mcp: "sendmock_sms_threads",
    ui: "SMS > conversation list",
  },
  "GET /api/v1/sms/{smsId}": {
    cli: "sendmock sms show <smsId>",
    mcp: "sendmock_sms_get",
    ui: "SMS > message > Message details",
  },
  "DELETE /api/v1/sms/{smsId}": {
    cli: "sendmock sms delete <smsId>",
    mcp: "sendmock_sms_delete",
    ui: "SMS > message menu > Delete",
  },
  "GET /api/v1/sms/{smsId}/media/{mediaIndex}": {
    cli: "sendmock sms media <smsId> <mediaIndex>",
    mcp: "sendmock://sms/{smsId}/media/{mediaIndex}",
    ui: "SMS > message > media",
  },
  "POST /api/v1/sms/{smsId}/open": {
    cli: "sendmock sms open <smsId>",
    mcp: "sendmock_sms_open",
    ui: "SMS > message menu > Simulate read",
  },
  "POST /api/v1/sms/{smsId}/reply-webhook/resend": {
    cli: "sendmock sms resend-reply-webhook <smsId>",
    mcp: "sendmock_sms_reply_webhook_resend",
    ui: "SMS > Message details > Reply webhook > Resend reply webhook",
  },
  "POST /api/v1/sms/{smsId}/status": {
    cli: "sendmock sms status <smsId> <status>",
    mcp: "sendmock_sms_set_status",
    ui: "SMS > Message details > Set status",
  },
  "POST /api/v1/sms/inbound": {
    cli: "sendmock sms inbound",
    mcp: "sendmock_sms_simulate_inbound",
    ui: "SMS > conversation > Reply as recipient",
  },
  "GET /api/v1/verify": {
    cli: "sendmock verify list",
    mcp: "sendmock_verify_list",
    ui: "SMS > Verify",
  },
  "GET /api/v1/verify/{verificationSid}": {
    cli: "sendmock verify show <verificationSid>",
    mcp: "sendmock_verify_get",
    ui: "SMS > Verify > open a verification",
  },
  "POST /api/v1/verify/{verificationSid}/force": {
    cli: "sendmock verify force <verificationSid> <status>",
    mcp: "sendmock_verify_force",
    ui: "SMS > Verify > verification > Approve, Cancel, Expire, Max attempts",
    cliArguments: { status: "state" },
  },
  "GET /api/v1/verify/services": {
    cli: "sendmock verify services list",
    mcp: "sendmock_verify_service_list",
    ui: "SMS > Verify > Services",
  },
  "POST /api/v1/verify/services": {
    cli: "sendmock verify services create",
    mcp: "sendmock_verify_service_create",
    ui: "SMS > Verify > Services > New service",
  },
  "PATCH /api/v1/verify/services/{serviceSid}": {
    cli: "sendmock verify services update <serviceSid>",
    mcp: "sendmock_verify_service_update",
    ui: "SMS > Verify > Services > Edit",
  },
  "DELETE /api/v1/verify/services/{serviceSid}": {
    cli: "sendmock verify services delete <serviceSid>",
    mcp: "sendmock_verify_service_delete",
    ui: "SMS > Verify > Services > Delete",
  },
  "GET /api/v1/numbers": {
    cli: "sendmock numbers list",
    mcp: "sendmock_number_list",
    ui: "Numbers",
  },
  "POST /api/v1/numbers": {
    cli: "sendmock numbers add",
    mcp: "sendmock_number_upsert",
    ui: "Numbers > Add number",
    selector: { input: "number_id", isGiven: false },
  },
  "PATCH /api/v1/numbers/{numberId}": {
    cli: "sendmock numbers update <numberId>",
    mcp: "sendmock_number_upsert",
    ui: "Numbers > Edit",
    selector: { input: "number_id", isGiven: true },
  },
  "DELETE /api/v1/numbers/{numberId}": {
    cli: "sendmock numbers remove <numberId>",
    mcp: "sendmock_number_delete",
    ui: "Numbers > Delete",
  },
  "GET /api/v1/messaging-services": {
    cli: "sendmock sms services list",
    mcp: "sendmock_messaging_service_list",
    ui: "Numbers > Messaging Services",
  },
  "POST /api/v1/messaging-services": {
    cli: "sendmock sms services create",
    mcp: "sendmock_messaging_service_create",
    ui: "Numbers > Messaging Services > New Messaging Service",
  },
  "PATCH /api/v1/messaging-services/{serviceSid}": {
    cli: "sendmock sms services update <serviceSid>",
    mcp: "sendmock_messaging_service_update",
    ui: "Numbers > Messaging Services > Edit",
  },
  "DELETE /api/v1/messaging-services/{serviceSid}": {
    cli: "sendmock sms services delete <serviceSid>",
    mcp: "sendmock_messaging_service_delete",
    ui: "Numbers > Messaging Services > Delete",
  },
};
