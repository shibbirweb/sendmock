import {
  secretRevealExemption,
  type SurfaceCatalogue,
} from "./surface-definition";

/** Email and SMS provider definitions (docs/plan/22-configurable-providers.md, EM-18, SM-16). */
export const messageProviderSurfaces: SurfaceCatalogue = {
  "GET /api/v1/emails/providers": {
    phase: "4",
    cli: "sendmock email providers list",
    mcp: "sendmock_email_provider_list",
    ui: "Mail > Providers",
  },
  "POST /api/v1/emails/providers": {
    phase: "4",
    cli: "sendmock email providers create",
    mcp: "sendmock_email_provider_create",
    ui: "Mail > Providers > Add provider",
  },
  "GET /api/v1/emails/providers/{providerKey}": {
    phase: "4",
    cli: "sendmock email providers show <providerKey>",
    mcp: "sendmock_email_provider_get",
    ui: "Mail > Providers > provider",
  },
  "PATCH /api/v1/emails/providers/{providerKey}": {
    phase: "4",
    cli: "sendmock email providers update <providerKey>",
    mcp: "sendmock_email_provider_update",
    ui: "Mail > Providers > provider > Save provider",
  },
  "DELETE /api/v1/emails/providers/{providerKey}": {
    phase: "4",
    cli: "sendmock email providers delete <providerKey>",
    mcp: "sendmock_email_provider_delete",
    ui: "Mail > Providers > provider > Remove or Delete",
  },
  "POST /api/v1/emails/providers/{providerKey}/restore": {
    phase: "4",
    cli: "sendmock email providers restore <providerKey>",
    mcp: "sendmock_email_provider_restore",
    ui: "Mail > Providers > Removed > Restore",
  },
  "POST /api/v1/emails/providers/{providerKey}/reset": {
    phase: "4",
    cli: "sendmock email providers reset <providerKey>",
    mcp: "sendmock_email_provider_reset",
    ui: "Mail > Providers > provider > Reset to default",
  },
  "POST /api/v1/emails/providers/{providerKey}/preview": {
    phase: "4",
    cli: "sendmock email providers preview <providerKey>",
    mcp: "sendmock_email_provider_preview",
    ui: "Mail > Providers > provider > Preview",
  },
  "GET /api/v1/emails/providers/{providerKey}/credentials/{credentialName}": {
    phase: "4",
    cli: "sendmock email providers credential <providerKey> <credentialName> --reveal",
    mcp: null,
    mcpExemptReason: secretRevealExemption,
    ui: "Mail > Providers > provider > General > Reveal",
  },
  "GET /api/v1/sms/providers": {
    phase: "2",
    cli: "sendmock sms providers list",
    mcp: "sendmock_sms_provider_list",
    ui: "SMS > Providers",
  },
  "POST /api/v1/sms/providers": {
    phase: "2",
    cli: "sendmock sms providers create",
    mcp: "sendmock_sms_provider_create",
    ui: "SMS > Providers > Add provider",
  },
  "GET /api/v1/sms/providers/{providerKey}": {
    phase: "2",
    cli: "sendmock sms providers show <providerKey>",
    mcp: "sendmock_sms_provider_get",
    ui: "SMS > Providers > provider",
  },
  "PATCH /api/v1/sms/providers/{providerKey}": {
    phase: "2",
    cli: "sendmock sms providers update <providerKey>",
    mcp: "sendmock_sms_provider_update",
    ui: "SMS > Providers > provider > Save provider",
  },
  "DELETE /api/v1/sms/providers/{providerKey}": {
    phase: "2",
    cli: "sendmock sms providers delete <providerKey>",
    mcp: "sendmock_sms_provider_delete",
    ui: "SMS > Providers > provider > Remove or Delete",
  },
  "POST /api/v1/sms/providers/{providerKey}/restore": {
    phase: "2",
    cli: "sendmock sms providers restore <providerKey>",
    mcp: "sendmock_sms_provider_restore",
    ui: "SMS > Providers > Removed > Restore",
  },
  "POST /api/v1/sms/providers/{providerKey}/reset": {
    phase: "2",
    cli: "sendmock sms providers reset <providerKey>",
    mcp: "sendmock_sms_provider_reset",
    ui: "SMS > Providers > provider > Reset to default",
  },
  "POST /api/v1/sms/providers/{providerKey}/preview": {
    phase: "2",
    cli: "sendmock sms providers preview <providerKey>",
    mcp: "sendmock_sms_provider_preview",
    ui: "SMS > Providers > provider > Preview",
  },
  "GET /api/v1/sms/providers/{providerKey}/credentials/{credentialName}": {
    phase: "2",
    cli: "sendmock sms providers credential <providerKey> <credentialName> --reveal",
    mcp: null,
    mcpExemptReason: secretRevealExemption,
    ui: "SMS > Providers > provider > General > Reveal",
  },
};
