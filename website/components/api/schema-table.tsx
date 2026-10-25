import type { JsonSchema, SchemaComponents } from "@/lib/openapi/openapi-types";
import {
  describeSchemaType,
  readReferenceName,
  resolveSchema,
} from "@/lib/openapi/schema-tools";

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
                    {resolveSchema(propertySchema, schemas).description ?? ""}
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
