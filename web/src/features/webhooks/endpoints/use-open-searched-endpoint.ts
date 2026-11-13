import { useNavigate, useSearch } from "@tanstack/react-router";
import * as React from "react";

import type { WebhookEndpoint } from "@/lib/api/types";

/**
 * `/webhooks/endpoints?endpoint=<endpointId>` opens that endpoint's sheet
 * once the list has loaded, as the links on every simulation do (WH-13.3).
 */
export function useOpenSearchedEndpoint(
  webhookEndpoints: WebhookEndpoint[] | undefined,
  openSheet: (webhookEndpoint: WebhookEndpoint) => void,
) {
  const { endpoint: searchedEndpointId } = useSearch({
    from: "/webhooks/endpoints",
  });
  const navigate = useNavigate({ from: "/webhooks/endpoints" });

  React.useEffect(() => {
    if (searchedEndpointId === undefined || webhookEndpoints === undefined) {
      return;
    }
    const searchedEndpoint = webhookEndpoints.find(
      (webhookEndpoint) => webhookEndpoint.id === searchedEndpointId,
    );
    if (searchedEndpoint !== undefined) {
      openSheet(searchedEndpoint);
    }
    void navigate({ search: {}, replace: true });
  }, [searchedEndpointId, webhookEndpoints, openSheet, navigate]);
}
