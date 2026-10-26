import {
  formatExampleValue,
  InlineCodeText,
} from "@/components/reference/input-table";
import type { JsonSchema, SchemaComponents } from "@/lib/openapi/openapi-types";
import { readAllowedValues } from "@/lib/openapi/schema-fields";
import {
  describeSchemaType,
  readReferenceName,
  resolveSchema,
} from "@/lib/openapi/schema-tools";

/** A field's description, the values it takes and an example (WS-04.4). */
function FieldFacts({
  propertySchema,
  schemas,
}: {
  propertySchema: JsonSchema;
  schemas: SchemaComponents;
}) {
  const description =
    propertySchema.description ??
    resolveSchema(propertySchema, schemas).description ??
    "";
  const allowedValues = readAllowedValues(propertySchema, schemas);
  const example = propertySchema.examples?.[0];
  const exampleText =
    example === undefined || example === null || typeof example === "object"
      ? null
      : formatExampleValue(example);

  return (
    <div className="grid gap-0.5">
      <span>
        <InlineCodeText text={description} />
      </span>
      {allowedValues !== null && allowedValues.length > 0 && (
        <span>
          One of:{" "}
          <InlineCodeText
            text={allowedValues
              .map((allowedValue) => `\`${formatExampleValue(allowedValue)}\``)
              .join(", ")}
          />
        </span>
      )}
      {exampleText !== null && exampleText !== "" && (
        <span>
          Example:{" "}
          <code className="font-mono text-xs break-all text-fd-foreground">
            {exampleText}
          </code>
        </span>
      )}
    </div>
  );
}

/** The fields of an object schema: name, type, whether required, description. */
export function SchemaTable({
  schema,
  schemas,
}: {
  schema: JsonSchema;
  schemas: SchemaComponents;
}) {
  const itemSchema =
    schema.type === "array" && schema.items ? schema.items : schema;
  const resolvedSchema = resolveSchema(itemSchema, schemas);
  const typeLabel = describeSchemaType(schema);
  const properties = Object.entries(resolvedSchema.properties ?? {});
  const requiredNames = new Set(resolvedSchema.required ?? []);

  return (
    <div className="grid gap-2">
      <p className="text-sm">
        <code className="font-mono">{typeLabel}</code>
        {resolvedSchema.description && (
          <span className="text-fd-muted-foreground">
            {" "}
            : {resolvedSchema.description}
          </span>
        )}
      </p>
      {properties.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-fd-muted text-fd-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-1.5 font-medium">
                  Field
                </th>
                <th scope="col" className="px-3 py-1.5 font-medium">
                  Type
                </th>
                <th scope="col" className="px-3 py-1.5 font-medium">
                  Description
                </th>
              </tr>
            </thead>
            <tbody>
              {properties.map(([propertyName, propertySchema]) => (
                <tr key={propertyName} className="border-t align-top">
                  <td className="px-3 py-1.5 font-mono text-xs">
                    {propertyName}
                    {requiredNames.has(propertyName) ? "" : "?"}
                  </td>
                  <td className="px-3 py-1.5 font-mono text-xs">
                    {readReferenceName(propertySchema) ??
                      describeSchemaType(propertySchema)}
                  </td>
                  <td className="px-3 py-1.5 text-fd-muted-foreground">
                    <FieldFacts
                      propertySchema={propertySchema}
                      schemas={schemas}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
