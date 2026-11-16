import {
  serializeStructuredData,
  type StructuredDataNode,
} from "@/lib/seo/structured-data";

/** Renders schema.org JSON-LD for search engines; nothing visible. */
export function StructuredDataScript({
  structuredData,
}: {
  structuredData: StructuredDataNode;
}) {
  return (
    <script
      type="application/ld+json"
      // The JSON is built from our own data and escaped by serializeStructuredData.
      dangerouslySetInnerHTML={{
        __html: serializeStructuredData(structuredData),
      }}
    />
  );
}
