import * as React from "react";

import { useHttpCatcherSearch } from "@/features/http/use-http-catcher-search";
import { useCheckedItems } from "@/hooks/use-checked-items";
import {
  useClearHttpRequests,
  useDeleteCapturedHttpRequest,
  useUpdateCapturedHttpRequest,
} from "@/lib/api/hooks/use-http-catcher-queries";
import type { CapturedHttpRequest, HttpBin } from "@/lib/api/types";

/**
 * What the request list toolbar does (UI-14): mark or delete the ticked
 * requests, and delete the bin's requests or every bin's.
 */
export function useCapturedRequestActions({
  capturedRequests,
  selectedBin,
  selectedRequestId,
}: {
  capturedRequests: CapturedHttpRequest[];
  selectedBin: HttpBin | null;
  selectedRequestId: string | null;
}) {
  const { selectRequest } = useHttpCatcherSearch();
  const checkedRequests = useCheckedItems(
    React.useMemo(
      () => capturedRequests.map((capturedRequest) => capturedRequest.id),
      [capturedRequests],
    ),
    selectedBin?.id ?? "all",
  );
  const updateRequest = useUpdateCapturedHttpRequest();
  const deleteRequest = useDeleteCapturedHttpRequest();
  const clearRequests = useClearHttpRequests();

  return {
    checkedRequests,
    markCheckedRequests: (isRead: boolean) => {
      checkedRequests.runForCheckedItems((requestId) => {
        updateRequest.mutate({ requestId, isRead });
      });
    },
    deleteCheckedRequests: () => {
      if (
        selectedRequestId !== null &&
        checkedRequests.isItemChecked(selectedRequestId)
      ) {
        selectRequest(null);
      }
      checkedRequests.runForCheckedItems((requestId) => {
        deleteRequest.mutate(requestId);
      });
    },
    deleteAllRequests: () => {
      selectRequest(null);
      clearRequests.mutate(selectedBin?.id ?? null);
    },
  };
}

export type CapturedRequestActions = ReturnType<
  typeof useCapturedRequestActions
>;
