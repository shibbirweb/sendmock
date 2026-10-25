import type { HttpBinPreset } from "@/lib/api/types";
import { findHttpBinPreset } from "@/lib/http/http-bin-presets";

/** Short badge text for a preset; null shows no badge. */
export function readPresetBadge(preset: HttpBinPreset | null): string | null {
  return findHttpBinPreset(preset)?.label.split(" ")[0] ?? null;
}
