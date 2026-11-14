import type { MockDatabase } from "@/mocks/db/mock-database";
import {
  formatTomlTable,
  toSecretReference,
} from "@/mocks/fixtures/seed-toml-format";
import { presentMessageProvider } from "@/mocks/providers/message-provider-record";

/**
 * Custom, changed and removed providers (EM-18.7, SM-16.7); an unchanged
 * built-in ships with SendMock and is left out. The definition is JSON with
 * secret credentials as `${ENV_VAR}` references.
 */
export function buildProviderTables(mockDatabase: MockDatabase): string[] {
  return mockDatabase.messageProviders.flatMap((providerRecord) => {
    const isModified = presentMessageProvider(
      mockDatabase,
      providerRecord,
    ).is_modified;
    if (
      providerRecord.is_builtin &&
      !isModified &&
      !providerRecord.is_removed
    ) {
      return [];
    }
    const definition = {
      ...providerRecord,
      credentials: providerRecord.credentials.map((credential) =>
        credential.is_secret
          ? {
              ...credential,
              value: toSecretReference(
                `${providerRecord.key}_${credential.name}`,
              ),
            }
          : credential,
      ),
    };

    return [
      formatTomlTable(`[[${providerRecord.area}.providers]]`, {
        key: providerRecord.key,
        name: providerRecord.name,
        edits_builtin: providerRecord.is_builtin,
        removed: providerRecord.is_removed,
        definition: JSON.stringify(definition),
      }),
    ];
  });
}
