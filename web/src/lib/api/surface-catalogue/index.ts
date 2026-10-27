import { emailSurfaces } from "./email-surfaces";
import { httpCatcherSurfaces } from "./http-catcher-surfaces";
import { messageProviderSurfaces } from "./message-provider-surfaces";
import { messageRuleSurfaces } from "./message-rule-surfaces";
import { paymentSurfaces } from "./payment-surfaces";
import { smsSurfaces } from "./sms-surfaces";
import type { OperationSurfaces, SurfaceCatalogue } from "./surface-definition";
import { systemSurfaces } from "./system-surfaces";
import { testHelperSurfaces } from "./test-helper-surfaces";
import { webhookDeliverySurfaces } from "./webhook-delivery-surfaces";
import { webhookSurfaces } from "./webhook-surfaces";
import { webhookTemplateSurfaces } from "./webhook-template-surfaces";

export type { OperationSurfaces, SurfaceCatalogue } from "./surface-definition";

/**
 * Every operation's CLI command, MCP tool and UI place, keyed like the endpoint
 * registry (`METHOD /api/v1/path`). A test keeps both lists equal (UI-11.1).
 */
export const surfaceCatalogue: SurfaceCatalogue = {
  ...systemSurfaces,
  ...emailSurfaces,
  ...messageRuleSurfaces,
  ...smsSurfaces,
  ...messageProviderSurfaces,
  ...httpCatcherSurfaces,
  ...paymentSurfaces,
  ...webhookSurfaces,
  ...webhookDeliverySurfaces,
  ...webhookTemplateSurfaces,
  ...testHelperSurfaces,
};

/** `GET /api/v1/emails/{emailId}`, the catalogue key of an endpoint. */
export function toOperationKey(method: string, path: string): string {
  return `${method} ${path}`;
}

export function findOperationSurfaces(
  method: string,
  path: string,
): OperationSurfaces | undefined {
  return surfaceCatalogue[toOperationKey(method, path)];
}
