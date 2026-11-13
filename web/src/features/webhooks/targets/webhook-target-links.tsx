import { Link } from "@tanstack/react-router";

import type { WebhookTarget } from "@/features/webhooks/targets/list-webhook-targets";

/**
 * Each endpoint's name, opening its details in a new tab so the form or menu
 * stays as it was (WH-13.3); "No webhook" when there is none.
 */
export function WebhookTargetLinks({ targets }: { targets: WebhookTarget[] }) {
  if (targets.length === 0) {
    return <span>No webhook</span>;
  }

  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1">
      {targets.map((webhookTarget) => (
        <li key={webhookTarget.endpointId}>
          <Link
            to="/webhooks/endpoints"
            search={{ endpoint: webhookTarget.endpointId }}
            target="_blank"
            rel="noopener"
            title={webhookTarget.endpointUrl}
            className="font-medium underline-offset-4 hover:underline"
          >
            {webhookTarget.endpointName}
          </Link>
        </li>
      ))}
    </ul>
  );
}
