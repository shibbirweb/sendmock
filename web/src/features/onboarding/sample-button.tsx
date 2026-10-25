import { SendIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useCreateSample } from "@/lib/api/hooks/use-sample-queries";
import type { SampleKind } from "@/lib/api/types";

const sampleButtonLabels: Record<SampleKind, string> = {
  email: "Send a sample email",
  sms: "Send a sample SMS",
  verification: "Start a sample verification",
  http: "Send a sample request",
};

/** Creates a sample through the API so the screen can be explored (UI-04.2). */
export function SampleButton({
  sampleKind,
  variant = "default",
}: {
  sampleKind: SampleKind;
  variant?: "default" | "outline";
}) {
  const createSample = useCreateSample();

  return (
    <Button
      size="sm"
      variant={variant}
      disabled={createSample.isPending}
      onClick={() => {
        createSample.mutate(sampleKind, {
          onError: () => {
            toast.error(
              `Could not create the sample ${sampleKind === "http" ? "request" : sampleKind}`,
            );
          },
        });
      }}
    >
      <SendIcon />
      {sampleButtonLabels[sampleKind]}
    </Button>
  );
}
