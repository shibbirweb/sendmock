import { ConfirmActionDialog } from "@/components/common/confirm-action-dialog";

/** "Delete X?" confirmation; open while `itemName` is set. */
export function ConfirmDeleteDialog({
  itemName,
  consequence,
  onConfirm,
  onClose,
}: {
  itemName: string | null;
  /** One sentence on what deleting changes for the user's app. */
  consequence: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <ConfirmActionDialog
      isOpen={itemName !== null}
      title={`Delete ${itemName ?? ""}?`}
      consequence={consequence}
      confirmLabel="Delete"
      cancelLabel="Keep it"
      onConfirm={onConfirm}
      onClose={onClose}
    />
  );
}
