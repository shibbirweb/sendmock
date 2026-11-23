import { useMutation } from "@tanstack/react-query";

import { requestApi } from "@/lib/api/api-client";
import type { PresetApplyInput, PresetApplyResult } from "@/lib/api/types";

/** Applies a stack preset (PL-27). */
export function useApplyPreset() {
  return useMutation({
    mutationFn: ({
      presetName,
      presetInput,
    }: {
      presetName: string;
      presetInput: PresetApplyInput;
    }) =>
      requestApi<PresetApplyResult>(
        `/presets/${encodeURIComponent(presetName)}/apply`,
        { method: "POST", requestBody: presetInput },
      ),
  });
}
