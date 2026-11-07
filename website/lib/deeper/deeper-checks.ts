import { listScreenStates, type loadDeeperInventory } from "./deeper-inventory";
import type { OperationSurfaces } from "./deeper-surfaces";
import type { DeeperPage } from "./deeper-types";

/** Controls with no entry, entries for controls the screen no longer has, unknown operations. */
export function findDeeperProblems(
  deeperPages: DeeperPage[],
  inventory: ReturnType<typeof loadDeeperInventory>,
  surfacesById: Map<string, OperationSurfaces>,
): string[] {
  return deeperPages.flatMap((deeperPage) => {
    const screenControls = new Set(
      listScreenStates(inventory, deeperPage.screen).flatMap(
        (screenState) => screenState.controls,
      ),
    );
    const documentedControls = new Set(
      deeperPage.entries.map((entry) => entry.control),
    );
    const missingEntries = [...screenControls]
      .filter((control) => !documentedControls.has(control))
      .map((control) => `${deeperPage.file}: no entry for "${control}"`);
    const staleEntries = [...documentedControls]
      .filter((control) => !screenControls.has(control))
      .map(
        (control) => `${deeperPage.file}: "${control}" is not on the screen`,
      );
    const unknownOperations = deeperPage.entries.flatMap((entry) =>
      (entry.operationIds ?? [])
        .filter((operationId) => !surfacesById.has(operationId))
        .map(
          (operationId) =>
            `${deeperPage.file}: unknown operation ${operationId}`,
        ),
    );
    const isEveryEntryDescribed = deeperPage.entries.every(
      (entry) => entry.does.trim() !== "",
    );
    return [
      ...missingEntries,
      ...staleEntries,
      ...unknownOperations,
      ...(isEveryEntryDescribed
        ? []
        : [`${deeperPage.file}: an entry says nothing`]),
    ];
  });
}
