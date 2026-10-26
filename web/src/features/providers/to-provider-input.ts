import type {
  MessageProviderDefinition,
  MessageProviderInput,
} from "@/lib/api/types";

/** The fields a save sends: the definition without its area and read-only state. */
export function toProviderInput(
  messageProvider: MessageProviderDefinition,
): MessageProviderInput {
  return {
    key: messageProvider.key,
    name: messageProvider.name,
    accent: messageProvider.accent,
    is_enabled: messageProvider.is_enabled,
    host: messageProvider.host,
    credentials: messageProvider.credentials,
    check_credentials: messageProvider.check_credentials,
    operations: messageProvider.operations,
    field_mapping: messageProvider.field_mapping,
    validation_rules: messageProvider.validation_rules,
    success_response: messageProvider.success_response,
    error_responses: messageProvider.error_responses,
    message_id_template: messageProvider.message_id_template,
    callback_template_key: messageProvider.callback_template_key,
    status_names: messageProvider.status_names,
    outcome_error_codes: messageProvider.outcome_error_codes,
  };
}
