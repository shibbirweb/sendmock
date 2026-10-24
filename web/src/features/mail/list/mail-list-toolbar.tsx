import { BellIcon, BellOffIcon, MailOpenIcon, Trash2Icon } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useMailNotifications } from "@/features/mail/list/use-mail-notifications";

type MailListToolbarProps = {
  loadedEmailCount: number;
  totalEmailCount: number;
  checkedEmailCount: number;
  onToggleAllChecked: (isChecked: boolean) => void;
  onMarkCheckedRead: () => void;
  onDeleteChecked: () => void;
  onDeleteAll: () => void;
};

export function MailListToolbar({
  loadedEmailCount,
  totalEmailCount,
  checkedEmailCount,
  onToggleAllChecked,
  onMarkCheckedRead,
  onDeleteChecked,
  onDeleteAll,
}: MailListToolbarProps) {
  const { isSupported, isEnabled, toggleNotifications } =
    useMailNotifications();
  const isAllChecked =
    loadedEmailCount > 0 && checkedEmailCount === loadedEmailCount;
  const hasChecked = checkedEmailCount > 0;

  return (
    <div className="flex h-10 items-center gap-2 border-b px-3 text-xs text-muted-foreground">
      <Checkbox
        checked={isAllChecked ? true : hasChecked ? "indeterminate" : false}
        onCheckedChange={(checkedState) => {
          onToggleAllChecked(checkedState === true);
        }}
        aria-label="Select all loaded emails"
        disabled={loadedEmailCount === 0}
      />
      <span>
        {hasChecked
          ? `${checkedEmailCount} selected`
          : `${totalEmailCount} email${totalEmailCount === 1 ? "" : "s"}`}
      </span>
      <div className="ml-auto flex items-center gap-1">
        {hasChecked ? (
          <>
            <Button variant="ghost" size="sm" onClick={onMarkCheckedRead}>
              <MailOpenIcon />
              Mark read
            </Button>
            <Button variant="ghost" size="sm" onClick={onDeleteChecked}>
              <Trash2Icon />
              Delete
            </Button>
          </>
        ) : (
          <>
            {isSupported && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-pressed={isEnabled}
                    aria-label={
                      isEnabled
                        ? "Turn off notifications"
                        : "Notify me about new emails"
                    }
                    onClick={() => {
                      void toggleNotifications();
                    }}
                  >
                    {isEnabled ? <BellIcon /> : <BellOffIcon />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isEnabled
                    ? "Notifications on"
                    : "Notify me about new emails"}
                </TooltipContent>
              </Tooltip>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Delete all emails"
                  disabled={totalEmailCount === 0}
                >
                  <Trash2Icon />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete all emails?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This removes all {totalEmailCount} captured emails. It
                    cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={onDeleteAll}
                  >
                    Delete all
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </div>
    </div>
  );
}
