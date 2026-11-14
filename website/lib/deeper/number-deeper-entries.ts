import type { ScreenState } from "./deeper-inventory";
import type { DeeperEntry, DeeperPage } from "./deeper-types";

export type NumberedEntry = {
  entryNumber: number;
  control: string;
  entry: DeeperEntry;
};

export type NumberedState = { state: string; numberedEntries: NumberedEntry[] };

/**
 * A page's entries per state, numbered in screen order across the whole page. The page and
 * its annotated screenshot both number from here, so a marker and its entry always agree.
 */
export function numberDeeperEntries(
  deeperPage: DeeperPage,
  screenStates: ScreenState[],
): NumberedState[] {
  const findEntry = (state: string, control: string) =>
    deeperPage.entries.find(
      (entry) => entry.control === control && entry.state === state,
    ) ??
    deeperPage.entries.find(
      (entry) => entry.control === control && entry.state === undefined,
    );
  let entryNumber = 0;
  return screenStates.map((screenState) => ({
    state: screenState.state,
    numberedEntries: screenState.controls.flatMap((control) => {
      const entry = findEntry(screenState.state, control);
      if (entry === undefined) {
        return [];
      }
      entryNumber += 1;
      return [{ entryNumber, control, entry }];
    }),
  }));
}
