import * as React from "react";
import { toast } from "sonner";

import { ApiError } from "@/lib/api/api-client";
import {
  useDeleteSavedScenario,
  useSaveScenario,
  useSavedScenarios,
  useUpdateSavedScenario,
} from "@/lib/api/hooks/use-saved-scenario-queries";
import type { SavedScenario } from "@/lib/api/types";

function showSaveError(saveError: Error) {
  toast.error(
    saveError instanceof ApiError
      ? saveError.message
      : "Could not save the scenario",
  );
}

/**
 * Which saved scenario the editor holds, and saving, renaming and deleting them (AI-07.3).
 * The editor's text stays with the page; this tracks whether it differs from the saved file.
 */
export function useSavedScenarioEditor({
  scenarioText,
  onOpen,
}: {
  scenarioText: string;
  onOpen: (scenarioText: string) => void;
}) {
  const [openedScenarioId, setOpenedScenarioId] = React.useState<string | null>(
    null,
  );
  const savedScenariosQuery = useSavedScenarios();
  const saveScenario = useSaveScenario();
  const updateSavedScenario = useUpdateSavedScenario();
  const deleteSavedScenario = useDeleteSavedScenario();
  const savedScenarios = savedScenariosQuery.data ?? [];
  const openedScenario =
    savedScenarios.find(
      (savedScenario) => savedScenario.id === openedScenarioId,
    ) ?? null;

  const saveAs = (scenarioName: string, onSaved: () => void) => {
    saveScenario.mutate(
      { name: scenarioName, scenario: scenarioText },
      {
        onSuccess: (savedScenario) => {
          setOpenedScenarioId(savedScenario.id);
          toast(`Saved ${savedScenario.name}`);
          onSaved();
        },
        onError: showSaveError,
      },
    );
  };

  return {
    savedScenarios,
    isLoading: savedScenariosQuery.isPending,
    openedScenario,
    hasUnsavedChanges:
      openedScenario !== null && openedScenario.scenario !== scenarioText,
    isSaving:
      saveScenario.isPending ||
      updateSavedScenario.isPending ||
      deleteSavedScenario.isPending,
    open: (savedScenario: SavedScenario) => {
      setOpenedScenarioId(savedScenario.id);
      onOpen(savedScenario.scenario);
    },
    /** Starts a new, unsaved scenario from whatever the editor gets next. */
    close: () => setOpenedScenarioId(null),
    saveAs,
    saveOpened: () => {
      if (openedScenario === null) {
        return;
      }
      updateSavedScenario.mutate(
        {
          scenarioId: openedScenario.id,
          scenarioChange: { scenario: scenarioText },
        },
        {
          onSuccess: () => toast(`Saved ${openedScenario.name}`),
          onError: showSaveError,
        },
      );
    },
    rename: (
      savedScenario: SavedScenario,
      scenarioName: string,
      onRenamed: () => void,
    ) => {
      updateSavedScenario.mutate(
        {
          scenarioId: savedScenario.id,
          scenarioChange: { name: scenarioName },
        },
        { onSuccess: onRenamed, onError: showSaveError },
      );
    },
    remove: (savedScenario: SavedScenario) => {
      deleteSavedScenario.mutate(savedScenario.id, {
        onSuccess: () => {
          if (savedScenario.id === openedScenarioId) {
            setOpenedScenarioId(null);
          }
          toast(`Deleted ${savedScenario.name}`);
        },
        onError: showSaveError,
      });
    },
  };
}

export type SavedScenarioEditor = ReturnType<typeof useSavedScenarioEditor>;
