import * as React from "react";
import { toast } from "sonner";

import { ConfirmActionDialog } from "@/components/common/confirm-action-dialog";
import { QueryErrorState } from "@/components/common/query-error-state";
import { Button } from "@/components/ui/button";
import {
  useClearMailgunComplaints,
  useMailgunComplaints,
} from "@/lib/api/hooks/use-mailgun-complaint-queries";
import type { MailgunComplaint } from "@/lib/api/types";

function groupByDomain(
  complaints: MailgunComplaint[],
): [string, MailgunComplaint[]][] {
  const complaintsByDomain = new Map<string, MailgunComplaint[]>();
  for (const complaint of complaints) {
    const domainComplaints = complaintsByDomain.get(complaint.domain) ?? [];
    domainComplaints.push(complaint);
    complaintsByDomain.set(complaint.domain, domainComplaints);
  }

  return [...complaintsByDomain.entries()];
}

/** Each Mailgun sending domain's complaints table, cleared a domain at a time (EM-23.5). */
export function MailgunComplaintsTab() {
  const complaintsQuery = useMailgunComplaints();
  const clearComplaints = useClearMailgunComplaints();
  const [clearedDomain, setClearedDomain] = React.useState<string | null>(null);
  const domainGroups = groupByDomain(complaintsQuery.data ?? []);

  return (
    <section className="grid gap-4" aria-label="Mailgun complaints">
      <p className="text-sm text-muted-foreground">
        A complaint about an email sent through Mailgun puts the address here,
        for its sending domain. A later send to it is accepted but not
        delivered, with reason suppress-complaint.
      </p>
      {complaintsQuery.isError && (
        <QueryErrorState
          message="Could not load the complaints."
          onRetry={() => void complaintsQuery.refetch()}
        />
      )}
      {complaintsQuery.isSuccess && domainGroups.length === 0 && (
        <p className="text-sm text-muted-foreground">No complaints yet.</p>
      )}
      {domainGroups.map(([domain, domainComplaints]) => (
        <div
          key={domain}
          className="grid gap-2 rounded-md border p-3"
          aria-label={`Complaints for ${domain}`}
          role="group"
        >
          <div className="flex items-center gap-2">
            <code className="font-mono text-sm">{domain}</code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="ms-auto"
              onClick={() => setClearedDomain(domain)}
            >
              Clear
            </Button>
          </div>
          <ul className="grid gap-1 text-sm">
            {domainComplaints.map((complaint) => (
              <li key={complaint.address} className="font-mono text-xs">
                {complaint.address}
              </li>
            ))}
          </ul>
        </div>
      ))}
      <ConfirmActionDialog
        isOpen={clearedDomain !== null}
        title={`Clear the complaints of ${clearedDomain ?? ""}?`}
        consequence="Sends to these addresses through Mailgun are delivered again."
        confirmLabel="Clear"
        onConfirm={() => {
          clearComplaints.mutate(clearedDomain ?? "", {
            onError: () => toast.error("Could not clear the complaints"),
          });
        }}
        onClose={() => setClearedDomain(null)}
      />
    </section>
  );
}
