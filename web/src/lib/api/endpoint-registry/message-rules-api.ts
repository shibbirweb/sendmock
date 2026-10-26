import {
  type ApiEndpoint,
  listOf,
  partialOf,
  tagEndpoints,
  typeRef,
} from "./endpoint-definition";

const tagRuleEndpoints = tagEndpoints("Tag rules", [
  {
    method: "GET",
    path: "/api/v1/tag-rules",
    summary: "Every tag rule, in the order they run.",
    response: listOf("TagRule"),
  },
  {
    method: "POST",
    path: "/api/v1/tag-rules",
    summary: "Add a tag rule at the end of the list.",
    requestBody: typeRef("TagRuleInput"),
    response: typeRef("TagRule"),
    successStatus: 201,
    errorStatuses: [400],
  },
  {
    method: "PATCH",
    path: "/api/v1/tag-rules/{ruleId}",
    summary: "Change a tag rule, or switch it on or off.",
    requestBody: partialOf("TagRuleInput"),
    response: typeRef("TagRule"),
    errorStatuses: [400, 404],
  },
  {
    method: "DELETE",
    path: "/api/v1/tag-rules/{ruleId}",
    summary: "Delete a tag rule.",
    response: null,
    successStatus: 204,
    errorStatuses: [404],
  },
  {
    method: "POST",
    path: "/api/v1/tag-rules/{ruleId}/move",
    summary: "Move a tag rule up or down.",
    requestBody: typeRef("MessageRuleMove"),
    response: listOf("TagRule"),
    errorStatuses: [404],
  },
]);

const forwardRuleEndpoints = tagEndpoints("Forward rules", [
  {
    method: "GET",
    path: "/api/v1/forward-rules",
    summary: "Every forward rule, in the order they run.",
    response: listOf("ForwardRule"),
  },
  {
    method: "POST",
    path: "/api/v1/forward-rules",
    summary: "Add a forward rule at the end of the list.",
    requestBody: typeRef("ForwardRuleInput"),
    response: typeRef("ForwardRule"),
    successStatus: 201,
    errorStatuses: [400],
  },
  {
    method: "PATCH",
    path: "/api/v1/forward-rules/{ruleId}",
    summary: "Change a forward rule, or switch it on or off.",
    requestBody: partialOf("ForwardRuleInput"),
    response: typeRef("ForwardRule"),
    errorStatuses: [400, 404],
  },
  {
    method: "DELETE",
    path: "/api/v1/forward-rules/{ruleId}",
    summary: "Delete a forward rule.",
    response: null,
    successStatus: 204,
    errorStatuses: [404],
  },
  {
    method: "POST",
    path: "/api/v1/forward-rules/{ruleId}/move",
    summary: "Move a forward rule up or down.",
    requestBody: typeRef("MessageRuleMove"),
    response: listOf("ForwardRule"),
    errorStatuses: [404],
  },
]);

export const messageRulesApi: ApiEndpoint[] = [
  ...tagRuleEndpoints,
  ...forwardRuleEndpoints,
];
