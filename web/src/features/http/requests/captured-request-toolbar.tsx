import { ListActionToolbar } from "@/components/common/list-action-toolbar";
import type { CapturedRequestActions } from "@/features/http/requests/use-captured-request-actions";
import type { HttpBin } from "@/lib/api/types";

const requestNoun = { one: "request", many: "requests" };

/** The shared list toolbar over a bin's requests, or over every bin's. */
export function CapturedRequestToolbar({
  loadedRequestCount,
  totalRequestCount,
  selectedBin,
  requestActions,
}: {
  loadedRequestCount: number;
  totalRequestCount: number;
  selectedBin: HttpBin | null;
  requestActions: CapturedRequestActions;
}) {
  const { checkedRequests } = requestActions;

  return (
    <ListActionToolbar
      itemNoun={requestNoun}
      loadedItemCount={loadedRequestCount}
      totalItemCount={totalRequestCount}
      checkedItemCount={checkedRequests.checkedItemCount}
      onToggleAllChecked={checkedRequests.setAllItemsChecked}
      onMarkCheckedRead={() => {
        requestActions.markCheckedRequests(true);
      }}
      onMarkCheckedUnread={() => {
        requestActions.markCheckedRequests(false);
      }}
      onDeleteChecked={requestActions.deleteCheckedRequests}
      isFiltered={false}
      deleteAllKeepsNote={
        selectedBin === null
          ? "Bins, their catch URLs and response rules stay."
          : `Only ${selectedBin.name}'s requests go; the bin, its catch URL and its rules stay.`
      }
      onDeleteAll={requestActions.deleteAllRequests}
    />
  );
}
