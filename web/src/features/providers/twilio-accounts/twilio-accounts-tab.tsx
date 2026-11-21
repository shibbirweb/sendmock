import { EyeIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { ConfirmActionDialog } from "@/components/common/confirm-action-dialog";
import { ConfirmDeleteDialog } from "@/components/common/confirm-delete-dialog";
import { CopyButton } from "@/components/common/copy-button";
import { IconButton } from "@/components/common/icon-button";
import { QueryErrorState } from "@/components/common/query-error-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  TwilioSubaccountDialog,
  twilioAccountStatusLabels,
} from "@/features/providers/twilio-accounts/twilio-subaccount-dialog";
import {
  useDeleteTwilioSubaccount,
  useRevealTwilioSubaccountToken,
  useTwilioSubaccounts,
} from "@/lib/api/hooks/use-twilio-account-queries";
import type { ProviderCredential, TwilioSubaccount } from "@/lib/api/types";

type RevealedToken = { accountSid: string; authToken: string };

function SubaccountRow({
  subaccount,
  revealedToken,
  onEdit,
  onReveal,
  onRemove,
}: {
  subaccount: TwilioSubaccount;
  revealedToken: string | null;
  onEdit: () => void;
  onReveal: () => void;
  onRemove: () => void;
}) {
  return (
    <li className="grid gap-1 rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{subaccount.friendly_name}</span>
        <Badge
          variant={subaccount.status === "active" ? "secondary" : "outline"}
        >
          {twilioAccountStatusLabels[subaccount.status]}
        </Badge>
        <div className="ms-auto flex items-center gap-1">
          <IconButton
            type="button"
            variant="ghost"
            size="icon-sm"
            label={`Edit ${subaccount.friendly_name}`}
            onClick={onEdit}
          >
            <PencilIcon />
          </IconButton>
          <IconButton
            type="button"
            variant="ghost"
            size="icon-sm"
            label={`Reveal the token of ${subaccount.friendly_name}`}
            onClick={onReveal}
          >
            <EyeIcon />
          </IconButton>
          <IconButton
            type="button"
            variant="ghost"
            size="icon-sm"
            label={`Remove ${subaccount.friendly_name}`}
            onClick={onRemove}
          >
            <Trash2Icon />
          </IconButton>
        </div>
      </div>
      <code className="font-mono text-xs text-muted-foreground">
        {subaccount.account_sid}
      </code>
      <p className="flex items-center gap-2 font-mono text-xs">
        Token {revealedToken ?? subaccount.auth_token}
        {revealedToken !== null && (
          <CopyButton copyText={revealedToken} label="Copy the token" />
        )}
      </p>
      {subaccount.debugger_url !== null && (
        <p className="text-xs text-muted-foreground">
          Debugger: {subaccount.debugger_url}
        </p>
      )}
    </li>
  );
}

/** The Twilio provider's main account and its subaccounts, each with its own token (SM-19.4). */
export function TwilioAccountsTab({
  savedCredentials,
}: {
  savedCredentials: ProviderCredential[];
}) {
  const subaccountsQuery = useTwilioSubaccounts();
  const deleteSubaccount = useDeleteTwilioSubaccount();
  const revealToken = useRevealTwilioSubaccountToken();
  const [editedSubaccount, setEditedSubaccount] =
    React.useState<TwilioSubaccount | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [revealCandidate, setRevealCandidate] =
    React.useState<TwilioSubaccount | null>(null);
  const [removalCandidate, setRemovalCandidate] =
    React.useState<TwilioSubaccount | null>(null);
  const [revealedToken, setRevealedToken] =
    React.useState<RevealedToken | null>(null);
  const mainAccountSid =
    savedCredentials.find((credential) => credential.name === "account_sid")
      ?.value ?? "";

  const openDialog = (subaccount: TwilioSubaccount | null) => {
    setEditedSubaccount(subaccount);
    setIsDialogOpen(true);
  };

  return (
    <section className="grid gap-4" aria-label="Twilio accounts">
      <div className="grid gap-1 rounded-md border bg-muted/30 p-3">
        <span className="font-medium">Main account</span>
        <code className="font-mono text-xs text-muted-foreground">
          {mainAccountSid}
        </code>
        <p className="text-xs text-muted-foreground">
          Its SID and token are the credentials on the General tab. It sees
          every subaccount through the Accounts API.
        </p>
      </div>
      {subaccountsQuery.isError ? (
        <QueryErrorState
          message="Could not load the subaccounts."
          onRetry={() => void subaccountsQuery.refetch()}
        />
      ) : (
        <ul className="grid gap-2" aria-label="Subaccounts">
          {(subaccountsQuery.data ?? []).map((subaccount) => (
            <SubaccountRow
              key={subaccount.account_sid}
              subaccount={subaccount}
              revealedToken={
                revealedToken?.accountSid === subaccount.account_sid
                  ? revealedToken.authToken
                  : null
              }
              onEdit={() => openDialog(subaccount)}
              onReveal={() => setRevealCandidate(subaccount)}
              onRemove={() => setRemovalCandidate(subaccount)}
            />
          ))}
        </ul>
      )}
      {subaccountsQuery.data?.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No subaccounts yet. Add one per customer to sign each customer's
          webhooks with its own token, or create them with the Accounts API.
        </p>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="justify-self-start"
        onClick={() => openDialog(null)}
      >
        <PlusIcon />
        Add subaccount
      </Button>
      <TwilioSubaccountDialog
        isOpen={isDialogOpen}
        editedSubaccount={editedSubaccount}
        onOpenChange={setIsDialogOpen}
      />
      <ConfirmActionDialog
        isOpen={revealCandidate !== null}
        title={`Reveal the token of ${revealCandidate?.friendly_name ?? ""}?`}
        consequence="The token is shown in plain text until you close the sheet."
        confirmLabel="Reveal"
        onConfirm={() => {
          const accountSid = revealCandidate?.account_sid ?? "";
          revealToken.mutate(accountSid, {
            onSuccess: (revealed) => {
              setRevealedToken({
                accountSid: revealed.account_sid,
                authToken: revealed.auth_token,
              });
            },
            onError: () => toast.error("Could not reveal the token"),
          });
        }}
        onClose={() => setRevealCandidate(null)}
      />
      <ConfirmDeleteDialog
        itemName={removalCandidate?.friendly_name ?? null}
        consequence="Sends under its SID then sign with the main account's token; its messages stay."
        onConfirm={() => {
          deleteSubaccount.mutate(removalCandidate?.account_sid ?? "", {
            onError: () => toast.error("Could not remove the subaccount"),
          });
        }}
        onClose={() => setRemovalCandidate(null)}
      />
    </section>
  );
}
