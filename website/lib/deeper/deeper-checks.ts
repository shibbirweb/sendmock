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
    const screenStates = listScreenStates(inventory, deeperPage.screen);
    const isDocumented = (state: string, control: string) =>
      deeperPage.entries.some(
        (entry) =>
          entry.control === control &&
          (entry.state === undefined || entry.state === state),
      );
    const missingEntries = screenStates.flatMap((screenState) =>
      screenState.controls
        .filter((control) => !isDocumented(screenState.state, control))
        .map(
          (control) =>
            `${deeperPage.file}: no entry for "${control}" (${screenState.state})`,
        ),
    );
    const staleEntries = deeperPage.entries
      .filter(
        (entry) =>
          !screenStates.some(
            (screenState) =>
              (entry.state === undefined ||
                entry.state === screenState.state) &&
              screenState.controls.includes(entry.control),
          ),
      )
      .map(
        (entry) =>
          `${deeperPage.file}: "${entry.control}" is not on the screen`,
      );
    const unknownOperations = deeperPage.entries.flatMap((entry) =>
      (entry.operationIds ?? [])
        .filter((operationId) => !surfacesById.has(operationId))
        .map(
          (operationId) =>
            `${deeperPage.file}: unknown operation ${operationId}`,
        ),
    );
    const entryKeys = deeperPage.entries.map(
      (entry) => `${entry.state ?? ""}|${entry.control}`,
    );
    const duplicateEntries = entryKeys
      .filter((entryKey, keyIndex) => entryKeys.indexOf(entryKey) !== keyIndex)
      .map((entryKey) => `${deeperPage.file}: two entries for "${entryKey}"`);
    const isEveryEntryDescribed = deeperPage.entries.every(
      (entry) => entry.does.trim() !== "",
    );
    return [
      ...missingEntries,
      ...staleEntries,
      ...unknownOperations,
      ...duplicateEntries,
      ...(isEveryEntryDescribed
        ? []
        : [`${deeperPage.file}: an entry says nothing`]),
    ];
  });
}
