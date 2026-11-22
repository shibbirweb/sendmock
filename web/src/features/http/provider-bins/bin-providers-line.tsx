import { XIcon } from "lucide-react";

import { IconButton } from "@/components/common/icon-button";
import { Badge } from "@/components/ui/badge";
import {
  useDetachProviderBin,
  useProviderBins,
} from "@/lib/api/hooks/use-provider-bin-queries";
import type { ProviderArea } from "@/lib/api/types";

const areaLabels: Record<ProviderArea, string> = {
  email: "Email",
  sms: "SMS",
  push: "Push",
  payments: "Payments",
};

/** The providers whose unmatched requests this bin answers, each with Detach (PL-21.5). */
export function BinProvidersLine({ binId }: { binId: string }) {
  const { data: providerBins = [] } = useProviderBins();
  const detachProviderBin = useDetachProviderBin();
  const attachedProviders = providerBins.filter(
    (providerBin) => providerBin.bin_id === binId,
  );
  if (attachedProviders.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span>Answers unmatched requests for</span>
      {attachedProviders.map((providerBin) => (
        <Badge
          key={`${providerBin.area}/${providerBin.provider_key}`}
          variant="secondary"
          className="gap-1 pr-0.5"
        >
          {providerBin.provider_key} ({areaLabels[providerBin.area]})
          <IconButton
            type="button"
            variant="ghost"
            size="icon-xs"
            className="size-4"
            label={`Detach ${providerBin.provider_key}`}
            onClick={() => {
              detachProviderBin.mutate({
                area: providerBin.area,
                providerKey: providerBin.provider_key,
              });
            }}
          >
            <XIcon className="size-3" />
          </IconButton>
        </Badge>
      ))}
    </div>
  );
}
