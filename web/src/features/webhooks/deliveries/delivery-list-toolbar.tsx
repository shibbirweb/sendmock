import * as React from "react";

import { CheckedListToolbar } from "@/components/common/checked-list-toolbar";
import { isDeliveryRetrying } from "@/features/webhooks/deliveries/delivery-status";
import type { CheckedItems } from "@/hooks/use-checked-items";
import {
  useDeleteDeliveries,
  useDeleteDelivery,
} from "@/lib/api/hooks/use-webhook-delivery-queries";
import type { DeliveryListFilters, WebhookDelivery } from "@/lib/api/types";

const deliveryNoun = { one: "delivery", many: "deliveries" };

/**
 * The list toolbar over the delivery log. Deliveries still queued or waiting
 * for a retry stay: cancel them first (UI-14.5).
 */
export function DeliveryListToolbar({
  webhookDeliveries,
  checkedDeliveries,
  totalDeliveryCount,
  deliveryFilters,
  isFiltered,
}: {
  webhookDeliveries: WebhookDelivery[];
  checkedDeliveries: CheckedItems;
  totalDeliveryCount: number;
  deliveryFilters: DeliveryListFilters;
  isFiltered: boolean;
}) {
  const deleteDelivery = useDeleteDelivery();
  const deleteDeliveries = useDeleteDeliveries();
  const retryingDeliveryIds = React.useMemo(
    () =>
      new Set(
        webhookDeliveries
          .filter(isDeliveryRetrying)
          .map((webhookDelivery) => webhookDelivery.id),
      ),
    [webhookDeliveries],
  );

  return (
    <CheckedListToolbar
      itemNoun={deliveryNoun}
      checkedItems={checkedDeliveries}
      loadedItemCount={webhookDeliveries.length}
      totalItemCount={totalDeliveryCount}
      isFiltered={isFiltered}
      deleteAllKeepsNote="Deliveries still queued or waiting for a retry stay; cancel them first."
      onDeleteItem={(deliveryId) => {
        if (!retryingDeliveryIds.has(deliveryId)) {
          deleteDelivery.mutate(deliveryId);
        }
      }}
      onDeleteAll={() => {
        deleteDeliveries.mutate(deliveryFilters);
      }}
    />
  );
}
