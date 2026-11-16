import * as React from "react";
import { toast } from "sonner";

import { useDeleteHttpBin } from "@/lib/api/hooks/use-http-catcher-queries";
import type { HttpBin } from "@/lib/api/types";

/** Delete for a bin, confirmed first (HC-01.6); its requests clear from the list toolbar. */
export function useHttpBinActions(onDeleted: () => void) {
  const deleteHttpBin = useDeleteHttpBin();
  const [pendingAction, setPendingAction] = React.useState<"delete" | null>(
    null,
  );

  return {
    pendingAction,
    askToDelete: () => {
      setPendingAction("delete");
    },
    closeDialog: () => {
      setPendingAction(null);
    },
    deleteBin: (httpBin: HttpBin) => {
      deleteHttpBin.mutate(httpBin.id, {
        onSuccess: () => {
          toast(`Bin ${httpBin.name} deleted`);
          onDeleted();
        },
      });
      setPendingAction(null);
    },
  };
}
