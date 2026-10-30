/**
 * `GET /api/v1/emails/{emailId}/timeline` becomes `getEmailsByEmailIdTimeline`: the
 * `operationId` in docs/api/openapi.yaml and in `GET /info`'s `available_operations`.
 */
export function buildOperationId(method: string, path: string): string {
  const pathWords = path
    .replace(/^\/api\/v1/, "")
    .split(/[/-]/)
    .filter((pathSegment) => pathSegment !== "")
    .map((pathSegment) => {
      const parameterMatch = pathSegment.match(/^\{(\w+)\}$/);
      const word = parameterMatch?.[1] ?? pathSegment;
      const capitalizedWord = word.charAt(0).toUpperCase() + word.slice(1);
      return parameterMatch ? `By${capitalizedWord}` : capitalizedWord;
    });

  return `${method.toLowerCase()}${pathWords.join("")}`;
}
