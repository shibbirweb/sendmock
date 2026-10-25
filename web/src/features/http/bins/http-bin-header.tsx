import { EraserIcon, Trash2Icon } from "lucide-react";

import { ConfirmActionDialog } from "@/components/common/confirm-action-dialog";
import { ConfirmDeleteDialog } from "@/components/common/confirm-delete-dialog";
import { CopyButton } from "@/components/common/copy-button";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useHttpBinActions } from "@/features/http/bins/use-http-bin-actions";
import { useCatchUrl } from "@/features/http/use-catch-url";
import type { useHttpCatcherSearch } from "@/features/http/use-http-catcher-search";
import type { HttpBin } from "@/lib/api/types";

const allBinsValue = "all";

function BinActions({
  httpBin,
  onDeleted,
}: {
  httpBin: HttpBin;
  onDeleted: () => void;
}) {
  const binActions = useHttpBinActions(onDeleted);
  const catchUrl = useCatchUrl(httpBin.name);

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <code
        data-testid="catch-url"
        className="min-w-0 truncate rounded bg-muted px-1.5 py-0.5 font-mono text-xs"
      >
        {catchUrl}
      </code>
      <CopyButton
        copyText={catchUrl}
        label="Copy catch URL"
        className="size-7"
      />
      <Button
        variant="ghost"
        size="sm"
        disabled={httpBin.request_count === 0}
        onClick={binActions.askToClear}
      >
        <EraserIcon />
        Clear requests
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="text-destructive"
        onClick={binActions.askToDelete}
      >
        <Trash2Icon />
        Delete bin
      </Button>
      <ConfirmActionDialog
        isOpen={binActions.pendingAction === "clear"}
        title={`Clear the requests in ${httpBin.name}?`}
        consequence="The captured requests go; the bin, its rules and its catch URL stay."
        confirmLabel="Clear requests"
        onConfirm={() => {
          binActions.clearRequests(httpBin);
        }}
        onClose={binActions.closeDialog}
      />
      <ConfirmDeleteDialog
        itemName={binActions.pendingAction === "delete" ? httpBin.name : null}
        consequence="Its requests and response rules go too. A new request to its catch URL creates it again, without rules."
        onConfirm={() => {
          binActions.deleteBin(httpBin);
        }}
        onClose={binActions.closeDialog}
      />
    </div>
  );
}

/** The selected bin: its catch URL, actions and the Requests / Responses tabs. */
export function HttpBinHeader({
  httpBins,
  selectedBin,
  catcherSearch,
}: {
  httpBins: HttpBin[];
  selectedBin: HttpBin | null;
  catcherSearch: ReturnType<typeof useHttpCatcherSearch>;
}) {
  return (
    <header className="grid gap-2 border-b px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold">
          {selectedBin?.name ?? "All requests"}
        </h2>
        <Select
          value={selectedBin?.id ?? allBinsValue}
          onValueChange={(binValue) => {
            catcherSearch.selectBin(
              binValue === allBinsValue ? null : binValue,
            );
          }}
        >
          <SelectTrigger aria-label="Bin" className="h-8 w-40 lg:hidden">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={allBinsValue}>All requests</SelectItem>
            {httpBins.map((httpBin) => (
              <SelectItem key={httpBin.id} value={httpBin.id}>
                {httpBin.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedBin !== null && (
          <Tabs
            value={catcherSearch.isResponsesTab ? "responses" : "requests"}
            onValueChange={(nextTab) => {
              catcherSearch.showResponsesTab(nextTab === "responses");
            }}
            className="ml-auto"
          >
            <TabsList>
              <TabsTrigger value="requests">Requests</TabsTrigger>
              <TabsTrigger value="responses">Responses</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </div>
      {selectedBin !== null && (
        <BinActions
          key={selectedBin.id}
          httpBin={selectedBin}
          onDeleted={() => {
            catcherSearch.selectBin(null);
          }}
        />
      )}
    </header>
  );
}
