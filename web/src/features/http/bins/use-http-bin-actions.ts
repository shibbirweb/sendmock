import * as React from "react";
import { toast } from "sonner";

import {
  useClearHttpRequests,
  useDeleteHttpBin,
} from "@/lib/api/hooks/use-http-catcher-queries";
import type { HttpBin } from "@/lib/api/types";

/** Clear and Delete for a bin, each confirmed first (HC-01.6). */
export function useHttpBinActions(onDeleted: () => void) {
  const clearHttpRequests = useClearHttpRequests();
  const deleteHttpBin = useDeleteHttpBin();
  const [pendingAction, setPendingAction] = React.useState<
    "clear" | "delete" | null
  >(null);

  return {
    pendingAction,
    askToClear: () => {
      setPendingAction("clear");
    },
    askToDelete: () => {
      setPendingAction("delete");
    },
    closeDialog: () => {
      setPendingAction(null);
    },
    clearRequests: (httpBin: HttpBin) => {
      clearHttpRequests.mutate(httpBin.id, {
        onSuccess: () => {
          toast(`Requests in ${httpBin.name} cleared`);
        },
      });
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
