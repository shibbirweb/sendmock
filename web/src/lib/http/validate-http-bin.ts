import type { HttpBin, HttpBinInput } from "@/lib/api/types";

export const binNamePattern = /^[a-z0-9][a-z0-9_-]{0,39}$/;

/** The problem with a new bin's name, or null; shared by the dialog and the API (HC-01.6). */
export function validateHttpBinName(
  binInput: HttpBinInput,
  existingBins: HttpBin[],
): string | null {
  if (!binNamePattern.test(binInput.name)) {
    return "Use 1 to 40 lowercase letters, digits, - or _, starting with a letter or digit";
  }
  if (existingBins.some((httpBin) => httpBin.name === binInput.name)) {
    return `A bin named ${binInput.name} already exists`;
  }

  return null;
}
