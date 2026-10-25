import * as React from "react";

import {
  fromNameValueRows,
  type NameValueRow,
} from "@/components/common/name-value-rows-editor";
import { toSendVariables } from "@/lib/webhooks/manual-send-request";

/** Prompt answers and overrides for one manual send (WH-05.5). */
export function useSendVariables() {
  const [promptValues, setPromptValues] = React.useState<
    Record<string, string>
  >({});
  const [overrideRows, setOverrideRows] = React.useState<NameValueRow[]>([]);

  return {
    promptValues,
    setPromptValue: (variableName: string, variableValue: string) => {
      setPromptValues((previousValues) => ({
        ...previousValues,
        [variableName]: variableValue,
      }));
    },
    overrideRows,
    setOverrideRows,
    sendVariables: toSendVariables(
      promptValues,
      fromNameValueRows(overrideRows),
    ),
  };
}
