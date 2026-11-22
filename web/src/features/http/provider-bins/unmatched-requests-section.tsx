import { Link } from "@tanstack/react-router";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toProviderBinName } from "@/features/http/provider-bins/to-provider-bin-name";
import { useHttpBins } from "@/lib/api/hooks/use-http-catcher-queries";
import {
  type ProviderReference,
  useAttachProviderBin,
  useDetachProviderBin,
  useProviderBins,
} from "@/lib/api/hooks/use-provider-bin-queries";

const answerNotFound = "not-found";

/** Where a provider's unmatched requests go: its own 404, or an HTTP Catcher bin (PL-21.1). */
export function UnmatchedRequestsSection({
  providerReference,
  providerName,
}: {
  providerReference: ProviderReference;
  providerName: string;
}) {
  const fieldId = React.useId();
  const { data: httpBins = [] } = useHttpBins();
  const { data: providerBins = [] } = useProviderBins();
  const attachProviderBin = useAttachProviderBin();
  const detachProviderBin = useDetachProviderBin();
  const attachedBin = providerBins.find(
    (providerBin) =>
      providerBin.area === providerReference.area &&
      providerBin.provider_key === providerReference.providerKey,
  );
  const attachBin = (binName: string) => {
    attachProviderBin.mutate({ providerReference, binName });
  };

  return (
    <section className="grid gap-2" aria-labelledby={`${fieldId}-heading`}>
      <h3 id={`${fieldId}-heading`} className="text-sm font-semibold">
        Unmatched requests
      </h3>
      <p className="text-xs text-muted-foreground">
        Requests on {providerName}&apos;s base URL that SendMock does not
        answer. Send them to a bin to answer them with its rules and follow-up
        webhooks.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={attachedBin?.bin_name ?? answerNotFound}
          onValueChange={(selectedValue) => {
            if (selectedValue === answerNotFound) {
              detachProviderBin.mutate(providerReference);
            } else {
              attachBin(selectedValue);
            }
          }}
        >
          <SelectTrigger
            className="w-64"
            aria-label={`Where ${providerName}'s unmatched requests go`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={answerNotFound}>Answer 404</SelectItem>
            {httpBins.map((httpBin) => (
              <SelectItem key={httpBin.id} value={httpBin.name}>
                Bin {httpBin.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {attachedBin === undefined ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={attachProviderBin.isPending}
            onClick={() => {
              attachBin(toProviderBinName(providerReference.providerKey));
            }}
          >
            Create a bin for this provider
          </Button>
        ) : (
          <Button type="button" variant="link" size="sm" asChild>
            <Link
              to="/http"
              search={{ bin: attachedBin.bin_id, tab: "responses" }}
            >
              Open its rules
            </Link>
          </Button>
        )}
      </div>
    </section>
  );
}
