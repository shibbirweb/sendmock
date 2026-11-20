import { FilePlus2Icon, SaveIcon } from "lucide-react";
import * as React from "react";

import { NamePromptDialog } from "@/components/common/name-prompt-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SavedScenarioEditor } from "@/features/scenarios/saved/use-saved-scenario-editor";

/** Which saved scenario the editor holds, the unsaved mark, Save and Save as (AI-07.3). */
export function SavedScenarioBar({
  savedScenarioEditor,
}: {
  savedScenarioEditor: SavedScenarioEditor;
}) {
  const [isNamingCopy, setNamingCopy] = React.useState(false);
  const { openedScenario } = savedScenarioEditor;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className="mr-auto flex min-w-0 items-center gap-2 text-sm">
        <span className="truncate font-medium">
          {openedScenario?.name ?? "Not saved"}
        </span>
        {savedScenarioEditor.hasUnsavedChanges && (
          <Badge variant="outline">Unsaved changes</Badge>
        )}
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={
          savedScenarioEditor.isSaving ||
          (openedScenario !== null && !savedScenarioEditor.hasUnsavedChanges)
        }
        onClick={() => {
          if (openedScenario === null) {
            setNamingCopy(true);
          } else {
            savedScenarioEditor.saveOpened();
          }
        }}
      >
        <SaveIcon />
        Save
      </Button>
      {openedScenario !== null && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={savedScenarioEditor.isSaving}
          onClick={() => setNamingCopy(true)}
        >
          <FilePlus2Icon />
          Save as
        </Button>
      )}
      {isNamingCopy && (
        <NamePromptDialog
          title={openedScenario === null ? "Save the scenario" : "Save a copy"}
          description="A unique name; the scenario then runs by it and travels in a setup."
          confirmLabel="Save"
          initialName={
            openedScenario === null ? "" : `${openedScenario.name}-copy`
          }
          isSubmitting={savedScenarioEditor.isSaving}
          onSubmit={(scenarioName) => {
            savedScenarioEditor.saveAs(scenarioName, () =>
              setNamingCopy(false),
            );
          }}
          onClose={() => setNamingCopy(false)}
        />
      )}
    </div>
  );
}
