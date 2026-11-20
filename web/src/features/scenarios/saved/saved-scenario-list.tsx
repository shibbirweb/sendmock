import { EllipsisIcon, FileCode2Icon } from "lucide-react";
import * as React from "react";

import { ConfirmDeleteDialog } from "@/components/common/confirm-delete-dialog";
import { IconButton } from "@/components/common/icon-button";
import { NamePromptDialog } from "@/components/common/name-prompt-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import type { SavedScenarioEditor } from "@/features/scenarios/saved/use-saved-scenario-editor";
import type { SavedScenario } from "@/lib/api/types";
import { cn } from "@/lib/utils";

function SavedScenarioRow({
  savedScenario,
  isOpened,
  onOpen,
  onRename,
  onDelete,
}: {
  savedScenario: SavedScenario;
  isOpened: boolean;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  return (
    <li
      className={cn(
        "flex items-center gap-1 rounded-md pr-1",
        isOpened && "bg-muted",
      )}
    >
      <button
        type="button"
        aria-current={isOpened ? "true" : undefined}
        className="grid min-w-0 flex-1 gap-0.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/60"
        onClick={onOpen}
      >
        <span className="truncate font-medium">{savedScenario.name}</span>
        {savedScenario.description !== "" && (
          <span className="truncate text-xs text-muted-foreground">
            {savedScenario.description}
          </span>
        )}
      </button>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <IconButton
            type="button"
            variant="ghost"
            size="icon-sm"
            label={`Actions for ${savedScenario.name}`}
          >
            <EllipsisIcon />
          </IconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onRename}>Rename</DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={onDelete}>
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

/** The saved scenarios beside the editor: open, rename and delete (AI-07.3). */
export function SavedScenarioList({
  savedScenarioEditor,
}: {
  savedScenarioEditor: SavedScenarioEditor;
}) {
  const [renamedScenario, setRenamedScenario] =
    React.useState<SavedScenario | null>(null);
  const [deletedScenario, setDeletedScenario] =
    React.useState<SavedScenario | null>(null);
  const { savedScenarios, openedScenario } = savedScenarioEditor;

  return (
    <aside aria-label="Saved scenarios" className="grid content-start gap-2">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold">
        <FileCode2Icon className="size-4 text-muted-foreground" />
        Saved
      </h3>
      {savedScenarioEditor.isLoading && <Skeleton className="h-16 w-full" />}
      {!savedScenarioEditor.isLoading && savedScenarios.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Nothing saved yet. Save the editor's scenario to run it again by name
          and keep it in a setup.
        </p>
      )}
      <ul className="grid gap-0.5">
        {savedScenarios.map((savedScenario) => (
          <SavedScenarioRow
            key={savedScenario.id}
            savedScenario={savedScenario}
            isOpened={savedScenario.id === openedScenario?.id}
            onOpen={() => savedScenarioEditor.open(savedScenario)}
            onRename={() => setRenamedScenario(savedScenario)}
            onDelete={() => setDeletedScenario(savedScenario)}
          />
        ))}
      </ul>
      {renamedScenario !== null && (
        <NamePromptDialog
          title="Rename the scenario"
          description="Runs and setups find it by its new name."
          confirmLabel="Rename"
          initialName={renamedScenario.name}
          isSubmitting={savedScenarioEditor.isSaving}
          onSubmit={(scenarioName) => {
            savedScenarioEditor.rename(renamedScenario, scenarioName, () =>
              setRenamedScenario(null),
            );
          }}
          onClose={() => setRenamedScenario(null)}
        />
      )}
      <ConfirmDeleteDialog
        itemName={deletedScenario?.name ?? null}
        consequence="The saved scenario is gone; the editor keeps its text."
        onConfirm={() => {
          if (deletedScenario !== null) {
            savedScenarioEditor.remove(deletedScenario);
          }
        }}
        onClose={() => setDeletedScenario(null)}
      />
    </aside>
  );
}
