import type {
  MessageProviderDefinition,
  MessageProviderInput,
} from "@/lib/api/types";

/** Problems with a provider's fields, shared by the Providers screens and the API (EM-18, SM-16). */
export type MessageProviderFieldErrors = Partial<
  Record<
    | "key"
    | "name"
    | "accent"
    | "credentials"
    | "operations"
    | "field_mapping"
    | "validation_rules",
    string
  >
>;

const providerKeyPattern = /^[a-z][a-z0-9_]{1,31}$/;
const credentialNamePattern = /^[A-Za-z0-9_.-]+$/;
/** Paths SendMock answers itself, never a provider's. */
const reservedPathPrefixes = ["/api/", "/providers/"];

type ProviderIdentity = Pick<
  MessageProviderDefinition,
  "key" | "name" | "host" | "is_enabled" | "is_removed" | "operations"
>;

function findDuplicate(names: string[]): string | undefined {
  return names.find(
    (candidateName, nameIndex) => names.indexOf(candidateName) !== nameIndex,
  );
}

/** `/v3/{domain}/messages` and `/v3/{name}/messages` are the same route. */
function normalizeRoute(method: string, path: string): string {
  return `${method} ${path.replace(/\{[^}]*\}/g, "{}")}`;
}

/** Why a path cannot be used, or undefined. */
export function findPathProblem(path: string): string | undefined {
  if (!path.startsWith("/")) {
    return `${path || "A path"} must start with /`;
  }
  if (reservedPathPrefixes.some((prefix) => path.startsWith(prefix))) {
    return `${path} is SendMock's own path; providers cannot use /api/ or /providers/`;
  }
  const openBraceCount = (path.match(/\{/g) ?? []).length;
  const closeBraceCount = (path.match(/\}/g) ?? []).length;
  if (openBraceCount !== closeBraceCount || /\{\}/.test(path)) {
    return `${path} has an unfinished {name} part`;
  }

  return undefined;
}

/** The key and name of a new provider in one area. */
export function validateNewProvider(
  providerKey: string,
  providerName: string,
  areaProviders: Pick<MessageProviderDefinition, "key">[],
): MessageProviderFieldErrors {
  const fieldErrors: MessageProviderFieldErrors = {};
  if (!providerKeyPattern.test(providerKey) || providerKey === "native") {
    fieldErrors.key =
      providerKey === "native"
        ? "native is SendMock's own API; choose another key"
        : "Use 2 to 32 lowercase letters, digits or _, starting with a letter";
  } else if (
    areaProviders.some((areaProvider) => areaProvider.key === providerKey)
  ) {
    fieldErrors.key = `A provider with the key ${providerKey} already exists`;
  }
  if (providerName.trim() === "") {
    fieldErrors.name = "Enter a name";
  }

  return fieldErrors;
}

/**
 * The provider whose route the input would share, when both are enabled and
 * their hosts do not tell them apart (docs/plan/22, Rules).
 */
export function findRouteClash(
  providerInput: Pick<
    MessageProviderInput,
    "key" | "host" | "is_enabled" | "operations"
  >,
  areaProviders: ProviderIdentity[],
): string | undefined {
  if (!providerInput.is_enabled) {
    return undefined;
  }
  const inputRoutes = new Set(
    providerInput.operations.map((operation) =>
      normalizeRoute(operation.method, operation.path),
    ),
  );
  const clashingProvider = areaProviders.find(
    (otherProvider) =>
      otherProvider.key !== providerInput.key &&
      otherProvider.is_enabled &&
      !otherProvider.is_removed &&
      !(
        otherProvider.host !== null &&
        providerInput.host !== null &&
        otherProvider.host !== providerInput.host
      ) &&
      otherProvider.operations.some((operation) =>
        inputRoutes.has(normalizeRoute(operation.method, operation.path)),
      ),
  );

  return clashingProvider === undefined
    ? undefined
    : `It answers the same path as ${clashingProvider.name}; give each a different host or path`;
}

/** Rules for a provider's fields; template problems come from the preview. */
export function validateMessageProvider(
  providerInput: MessageProviderInput,
  areaProviders: ProviderIdentity[],
): MessageProviderFieldErrors {
  const fieldErrors: MessageProviderFieldErrors = {};
  if (providerInput.name.trim() === "") {
    fieldErrors.name = "Enter a name";
  }
  if (!/^#[0-9a-f]{6}$/i.test(providerInput.accent)) {
    fieldErrors.accent = "Use a colour like #1e5bb8";
  }
  const credentialNames = providerInput.credentials.map(
    (credential) => credential.name,
  );
  const badCredentialName = credentialNames.find(
    (credentialName) => !credentialNamePattern.test(credentialName),
  );
  if (badCredentialName !== undefined) {
    fieldErrors.credentials = `${badCredentialName || "A credential"} needs a name of letters, digits, _, . or -`;
  } else if (findDuplicate(credentialNames) !== undefined) {
    fieldErrors.credentials = `${findDuplicate(credentialNames)} appears twice`;
  }
  const pathProblem = providerInput.operations
    .map((operation) => findPathProblem(operation.path))
    .find((problem) => problem !== undefined);
  if (providerInput.operations.length === 0) {
    fieldErrors.operations = "Answer at least one request";
  } else if (pathProblem !== undefined) {
    fieldErrors.operations = pathProblem;
  } else {
    fieldErrors.operations = findRouteClash(providerInput, areaProviders);
  }
  const duplicatePart = findDuplicate(
    providerInput.field_mapping.map((fieldMapping) => fieldMapping.part),
  );
  if (duplicatePart !== undefined) {
    fieldErrors.field_mapping = `${duplicatePart} is mapped twice`;
  }
  if (
    providerInput.field_mapping.some(
      (fieldMapping) => fieldMapping.source.trim() === "",
    )
  ) {
    fieldErrors.field_mapping = "Every mapped part needs a source";
  }

  return Object.fromEntries(
    Object.entries(fieldErrors).filter(
      ([, fieldError]) => fieldError !== undefined,
    ),
  );
}
