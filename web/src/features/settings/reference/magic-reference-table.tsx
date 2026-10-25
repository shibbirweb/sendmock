import { CopyButton } from "@/components/common/copy-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { MagicReferenceRow } from "@/features/settings/reference/magic-reference-data";

/** Addresses or numbers that always produce an outcome, with copy buttons. */
export function MagicReferenceTable({
  caption,
  triggerHeading,
  referenceRows,
}: {
  caption: string;
  triggerHeading: string;
  referenceRows: MagicReferenceRow[];
}) {
  return (
    <div className="grid gap-1.5">
      <h4 className="text-sm font-medium">{caption}</h4>
      <div className="min-w-0 rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{triggerHeading}</TableHead>
              <TableHead>Outcome</TableHead>
              <TableHead className="hidden sm:table-cell">Code</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {referenceRows.map((referenceRow) => {
              const firstTrigger =
                referenceRow.trigger.split(",")[0]?.trim() ?? "";

              return (
                <TableRow key={referenceRow.trigger}>
                  <TableCell className="max-w-56 whitespace-normal">
                    <span className="flex items-start gap-1 font-mono text-xs break-all">
                      {referenceRow.trigger}
                      {!firstTrigger.includes("<any>") && (
                        <CopyButton
                          copyText={firstTrigger}
                          label={`Copy ${firstTrigger}`}
                          className="size-5 shrink-0"
                        />
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    {referenceRow.outcome}
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs sm:table-cell">
                    {referenceRow.code ?? ""}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
