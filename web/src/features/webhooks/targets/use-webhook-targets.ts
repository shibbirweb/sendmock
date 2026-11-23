import * as React from "react";

import {
  listWebhookTargets,
  type WebhookTarget,
} from "@/features/webhooks/targets/list-webhook-targets";
import {
  replaceRequestEdit,
  toWebhookChoice,
} from "@/features/webhooks/targets/webhook-request-edits";
import { useIsOperationQueryable } from "@/lib/api/hooks/use-operation-availability";
import { useWebhookEndpoints } from "@/lib/api/hooks/use-webhook-queries";
import { useWebhookRuleMatch } from "@/lib/api/hooks/use-webhook-rule-queries";
import type {
  AppEventType,
  WebhookChoice,
  WebhookRequestEdit,
  WebhookRuleMatchRequest,
} from "@/lib/api/types";

/** The event a simulation is about to fire, as the match reads it. */
export type WebhookTargetEvent = {
  eventType: AppEventType;
  /** The email, SMS or payment it is about, when it is stored already. */
  subjectId?: string;
  /** Filter fields of a message not stored yet, or that the event changes. */
  data?: Record<string, string[]>;
};

export type WebhookTargetsState = {
  eventType: AppEventType;
  targetEvent: WebhookTargetEvent;
  /** False on a SendMock that cannot answer the match; nothing is shown. */
  isShown: boolean;
  isChecking: boolean;
  targets: WebhookTarget[];
  /** The rule matches, which the picker checks at first. */
  matchedEndpointIds: string[];
  /** Null while the rules decide; else the endpoints chosen for this action. */
  chosenEndpointIds: string[] | null;
  chooseEndpoints: (endpointIds: string[] | null) => void;
  /** Payloads edited for this action, by endpoint (WH-14.3). */
  requestEdits: WebhookRequestEdit[];
  /** Keeps an edit for its endpoint, or removes it with null. */
  saveRequestEdit: (
    endpointId: string,
    requestEdit: WebhookRequestEdit | null,
  ) => void;
  /** User variables for this action's webhooks, chosen in the picker (EM-27.1). */
  userVariables: Record<string, string>;
  /** Sets the chosen endpoints and their edits at once, as the picker confirms. */
  applyChoice: (pickerChoice: WebhookPickerChoice) => void;
  /** Spread into the action's request body. */
  webhookChoice: WebhookChoice;
};

/** What the picker confirms: the endpoints, and the payloads edited for them. */
export type WebhookPickerChoice = {
  endpointIds: string[];
  requestEdits: WebhookRequestEdit[];
  /** Your app's ids for this action's webhooks, merged into `user_variables` (EM-27.1). */
  userVariables?: Record<string, string>;
};

/** Which webhooks a simulation will trigger, and the choice for this one action (WH-13.2, WH-13.4). */
export function useWebhookTargets(
  targetEvent: WebhookTargetEvent,
): WebhookTargetsState {
  const isMatchServed = useIsOperationQueryable(
    "POST /api/v1/webhooks/rules/match",
  );
  const matchRequest: WebhookRuleMatchRequest = {
    event_type: targetEvent.eventType,
    subject_id: targetEvent.subjectId,
    data: targetEvent.data,
  };
  const matchQuery = useWebhookRuleMatch(matchRequest, isMatchServed);
  const endpointsQuery = useWebhookEndpoints();
  const [chosenEndpointIds, setChosenEndpointIds] = React.useState<
    string[] | null
  >(null);
  const [requestEdits, setRequestEdits] = React.useState<WebhookRequestEdit[]>(
    [],
  );
  const [userVariables, setUserVariables] = React.useState<
    Record<string, string>
  >({});
  const targets = listWebhookTargets({
    matchResult: matchQuery.data,
    chosenEndpointIds,
    webhookEndpoints: endpointsQuery.data ?? [],
  });

  return {
    eventType: targetEvent.eventType,
    targetEvent,
    isShown: isMatchServed,
    isChecking: isMatchServed && matchQuery.isPending,
    targets,
    matchedEndpointIds: [
      ...new Set(
        (matchQuery.data?.webhook_rules ?? []).map(
          (matchedRule) => matchedRule.endpoint_id,
        ),
      ),
    ],
    chosenEndpointIds,
    chooseEndpoints: setChosenEndpointIds,
    requestEdits,
    saveRequestEdit: (endpointId, requestEdit) => {
      setRequestEdits((previousEdits) =>
        replaceRequestEdit(previousEdits, endpointId, requestEdit),
      );
    },
    userVariables,
    applyChoice: (pickerChoice) => {
      setChosenEndpointIds(pickerChoice.endpointIds);
      setRequestEdits(pickerChoice.requestEdits);
      setUserVariables(pickerChoice.userVariables ?? {});
    },
    webhookChoice: {
      ...toWebhookChoice({
        chosenEndpointIds,
        targetEndpointIds: targets.map(
          (webhookTarget) => webhookTarget.endpointId,
        ),
        requestEdits,
      }),
      ...(Object.keys(userVariables).length === 0
        ? {}
        : { user_variables: userVariables }),
    },
  };
}
