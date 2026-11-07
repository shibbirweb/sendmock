import { MousePointerClickIcon } from "lucide-react";
import { toast } from "sonner";

import {
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { useClickEmailLink } from "@/lib/api/hooks/use-email-queries";
import { useOperationAvailability } from "@/lib/api/hooks/use-operation-availability";
import type { EmailDetail } from "@/lib/api/types";

/**
 * Simulate > Click a link: one item per link in the email, each firing
 * `email.clicked` with `source: "manual"` (EM-20.2). Hidden when the email has
 * no links or the running SendMock does not record clicks.
 */
export function SimulateClickMenu({ email }: { email: EmailDetail }) {
  const clickEmailLink = useClickEmailLink();
  const isClickServed = useOperationAvailability(
    "POST /api/v1/emails/{emailId}/clicks",
  ).isAvailable;
  if (!isClickServed || email.extracted.links.length === 0) {
    return null;
  }

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <MousePointerClickIcon />
        Click a link (email.clicked)
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="max-w-80">
        {email.extracted.links.map((emailLink) => (
          <DropdownMenuItem
            key={emailLink}
            title={emailLink}
            onSelect={() => {
              clickEmailLink.mutate({
                emailId: email.id,
                url: emailLink,
                clickSource: "manual",
              });
              toast("email.clicked fired");
            }}
          >
            <span className="truncate">{emailLink}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
