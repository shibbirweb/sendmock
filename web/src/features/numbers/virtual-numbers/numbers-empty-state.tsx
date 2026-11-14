import { PhoneIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { NoDataState } from "@/features/onboarding/no-data-state";
import { useSaveVirtualNumber } from "@/lib/api/hooks/use-numbers-queries";
import type { VirtualNumberInput } from "@/lib/api/types";

const sampleNumberInput: VirtualNumberInput = {
  number: "+15550001111",
  label: "Sample number",
  channels: ["sms"],
  inbound_url: null,
  inbound_method: "POST",
  inbound_fallback_url: null,
  inbound_template_id: null,
  status_callback_url: null,
  messaging_service_sid: null,
};

/** No numbers yet: they are optional, and one click adds a sample (UI-04.2). */
export function NumbersEmptyState() {
  const saveVirtualNumber = useSaveVirtualNumber();

  return (
    <NoDataState
      icon={PhoneIcon}
      title="No numbers yet"
      description="Numbers are optional: any From is accepted. Add one to give it an inbound webhook, a default status callback or a Messaging Service."
    >
      <Button
        size="sm"
        disabled={saveVirtualNumber.isPending}
        onClick={() => {
          saveVirtualNumber.mutate(
            { numberId: null, numberInput: sampleNumberInput },
            {
              onError: () => {
                toast.error("Could not add the sample number");
              },
            },
          );
        }}
      >
        <PlusIcon />
        Add a sample number
      </Button>
    </NoDataState>
  );
}
