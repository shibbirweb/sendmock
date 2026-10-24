import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useReleaseEmail } from "@/lib/api/hooks/use-email-detail-queries";
import type { EmailDetail } from "@/lib/api/types";

type ReleaseEmailDialogProps = {
  email: EmailDetail;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
};

/** Sends the captured email through the configured SMTP relay (EM-14.2). */
export function ReleaseEmailDialog({
  email,
  isOpen,
  onOpenChange,
}: ReleaseEmailDialogProps) {
  const releaseEmail = useReleaseEmail();
  const [recipientText, setRecipientText] = React.useState(
    email.envelope_to.join(", "),
  );

  const recipientAddresses = recipientText
    .split(",")
    .map((recipientAddress) => recipientAddress.trim())
    .filter(Boolean);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Release to real SMTP</DialogTitle>
          <DialogDescription>
            Sends this email through your relay server so you can check it in a
            real inbox. Only recipients on the relay allowlist are accepted.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="release-recipients">
            Recipients (comma separated)
          </Label>
          <Input
            id="release-recipients"
            value={recipientText}
            onChange={(changeEvent) => {
              setRecipientText(changeEvent.target.value);
            }}
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button
            disabled={recipientAddresses.length === 0 || releaseEmail.isPending}
            onClick={() => {
              releaseEmail.mutate(
                { emailId: email.id, recipientAddresses },
                {
                  onSuccess: () => {
                    toast.success(
                      "Release recorded (demo data: nothing was sent)",
                    );
                    onOpenChange(false);
                  },
                  onError: (releaseError) => {
                    toast.error(releaseError.message);
                  },
                },
              );
            }}
          >
            Release
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
