import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/** Asks before an action that cannot be undone. */
export function ConfirmActionDialog({
  isOpen,
  title,
  consequence,
  confirmLabel,
  cancelLabel = "Cancel",
  onConfirm,
  onClose,
}: {
  isOpen: boolean;
  title: string;
  /** One sentence on what the action changes for the user's app. */
  consequence: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <AlertDialog
      open={isOpen}
      onOpenChange={(isDialogOpen) => {
        if (!isDialogOpen) {
          onClose();
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{consequence}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
