import { useNavigate, useSearch } from "@tanstack/react-router";

import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { DeliveryActions } from "@/features/webhooks/deliveries/detail/delivery-actions";
import { DeliveryAttemptsList } from "@/features/webhooks/deliveries/detail/delivery-attempts-list";
import { DeliveryOverview } from "@/features/webhooks/deliveries/detail/delivery-overview";
import { HttpExchangeView } from "@/features/webhooks/deliveries/detail/http-exchange-view";
import { useWebhookDelivery } from "@/lib/api/hooks/use-webhook-delivery-queries";

function DeliveryDrawerContent({ deliveryId }: { deliveryId: string }) {
  const deliveryQuery = useWebhookDelivery(deliveryId);

  if (deliveryQuery.isPending) {
    return (
      <div className="grid gap-3 px-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (deliveryQuery.isError) {
    return (
      <p className="px-4 text-sm text-destructive">
        This delivery is no longer in the log. It may have been pruned.
      </p>
    );
  }

  const deliveryDetail = deliveryQuery.data;

  return (
    <div className="grid min-w-0 gap-5 px-4 pb-6">
      <DeliveryOverview deliveryDetail={deliveryDetail} />
      <DeliveryActions deliveryDetail={deliveryDetail} />
      {deliveryDetail.attempts.length > 1 && (
        <DeliveryAttemptsList deliveryDetail={deliveryDetail} />
      )}
      <Separator />
      {deliveryDetail.request === null ? (
        <p className="text-sm text-muted-foreground">
          Nothing was sent: the template failed to render, so there is no
          request or response.
        </p>
      ) : (
        <HttpExchangeView
          recordedRequest={deliveryDetail.request}
          recordedResponse={deliveryDetail.response}
        />
      )}
    </div>
  );
}

/** One delivery's detail, open while `?delivery=` is set (WH-03.8). */
export function DeliveryDrawer() {
  const { delivery: openDeliveryId } = useSearch({
    from: "/webhooks/deliveries",
  });
  const navigate = useNavigate({ from: "/webhooks/deliveries" });

  return (
    <Sheet
      open={openDeliveryId !== undefined}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          void navigate({
            search: (previousSearch) => ({
              ...previousSearch,
              delivery: undefined,
            }),
          });
        }
      }}
    >
      <SheetContent className="w-full gap-0 overflow-y-auto data-[side=right]:sm:max-w-4xl">
        <SheetHeader>
          <SheetTitle>Delivery</SheetTitle>
          <SheetDescription>
            The request SendMock sent and what your endpoint answered.
          </SheetDescription>
        </SheetHeader>
        {openDeliveryId !== undefined && (
          <DeliveryDrawerContent deliveryId={openDeliveryId} />
        )}
      </SheetContent>
    </Sheet>
  );
}
