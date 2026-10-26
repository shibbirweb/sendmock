import type { MockDatabase } from "@/mocks/db/mock-database";
import {
  readTemplateDefinition,
  type TemplateDefinition,
} from "@/mocks/fixtures/template-definitions";

/** A template's request shape: a custom one from the database, else the fixtures. */
export function findTemplateDefinition(
  database: MockDatabase,
  templateId: string,
): TemplateDefinition {
  return (
    database.customTemplateDefinitions.get(templateId) ??
    readTemplateDefinition(templateId)
  );
}
