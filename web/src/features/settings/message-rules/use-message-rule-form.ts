import * as React from "react";

import {
  type MessageRuleKind,
  type MessageRuleTypes,
  useSaveMessageRule,
} from "@/lib/api/hooks/use-message-rule-queries";
import {
  type BuilderGroup,
  createNodeIdGenerator,
  toBuilderTree,
  toRuleFilter,
} from "@/lib/webhooks/rule-filter/builder-tree";
import { findFirstFilterError } from "@/lib/webhooks/rule-filter/validate-rule-filter";

export type MessageRuleFormValues = {
  name: string;
  tag: string;
  forwardAddresses: string[];
  rootGroup: BuilderGroup;
  isEnabled: boolean;
};

type MessageRuleFieldErrors = Partial<
  Record<"name" | "tag" | "forwardAddresses" | "filter", string>
>;

type StoredRule = MessageRuleTypes[MessageRuleKind]["rule"];

const emailAddressPattern = /^[^\s@]+@[^\s@]+$/;

function toFormValues(editedRule: StoredRule | null): MessageRuleFormValues {
  return {
    name: editedRule?.name ?? "",
    tag: editedRule !== null && "tag" in editedRule ? editedRule.tag : "",
    forwardAddresses:
      editedRule !== null && "to" in editedRule ? editedRule.to : [],
    rootGroup: toBuilderTree(
      editedRule?.filter ?? null,
      createNodeIdGenerator(),
    ),
    isEnabled: editedRule?.is_enabled ?? true,
  };
}

function validateFormValues(
  ruleKind: MessageRuleKind,
  formValues: MessageRuleFormValues,
): MessageRuleFieldErrors {
  const fieldErrors: MessageRuleFieldErrors = {};
  if (formValues.name.trim() === "") {
    fieldErrors.name = "Enter a name";
  }
  if (ruleKind === "tag-rules" && formValues.tag.trim() === "") {
    fieldErrors.tag = "Enter the tag to add";
  }
  if (ruleKind === "forward-rules") {
    const invalidAddress = formValues.forwardAddresses.find(
      (forwardAddress) => !emailAddressPattern.test(forwardAddress),
    );
    if (formValues.forwardAddresses.length === 0) {
      fieldErrors.forwardAddresses = "Add at least one address";
    } else if (invalidAddress !== undefined) {
      fieldErrors.forwardAddresses = `${invalidAddress} is not an email address`;
    }
  }
  const filterError = findFirstFilterError(toRuleFilter(formValues.rootGroup));
  if (filterError !== undefined) {
    fieldErrors.filter = filterError;
  }

  return fieldErrors;
}

/** State, checks and saving for a tag or auto-forward rule (EM-12.3, EM-14.3). */
export function useMessageRuleForm({
  ruleKind,
  editedRule,
  onSaved,
}: {
  ruleKind: MessageRuleKind;
  editedRule: StoredRule | null;
  onSaved: () => void;
}) {
  const saveMessageRule = useSaveMessageRule(ruleKind);
  const [formValues, setFormValues] = React.useState(() =>
    toFormValues(editedRule),
  );
  const [hasTriedSaving, setHasTriedSaving] = React.useState(false);
  const fieldErrors = hasTriedSaving
    ? validateFormValues(ruleKind, formValues)
    : {};

  const updateFormValues = React.useCallback(
    (changedValues: Partial<MessageRuleFormValues>) => {
      setFormValues((currentValues) => ({
        ...currentValues,
        ...changedValues,
      }));
    },
    [],
  );

  const saveRule = () => {
    setHasTriedSaving(true);
    if (Object.keys(validateFormValues(ruleKind, formValues)).length > 0) {
      return;
    }
    const sharedInput = {
      name: formValues.name.trim(),
      filter: toRuleFilter(formValues.rootGroup),
      is_enabled: formValues.isEnabled,
    };
    saveMessageRule.mutate(
      {
        ruleId: editedRule?.id ?? null,
        ruleInput:
          ruleKind === "tag-rules"
            ? { ...sharedInput, tag: formValues.tag.trim() }
            : { ...sharedInput, to: formValues.forwardAddresses },
      },
      { onSuccess: onSaved },
    );
  };

  return {
    formValues,
    updateFormValues,
    fieldErrors,
    hasTriedSaving,
    isSaving: saveMessageRule.isPending,
    saveRule,
  };
}
