import type {
  PaymentGatewayDefinition,
  PaymentGatewayInput,
} from "@/lib/api/types";

export type PaymentGatewayFieldErrors = Partial<
  Record<
    | "key"
    | "name"
    | "accent"
    | "method_keys"
    | "credentials"
    | "redirect_fields"
    | "notification_headers",
    string
  >
>;

const gatewayKeyPattern = /^[a-z][a-z0-9_]{1,31}$/;
const fieldNamePattern = /^[A-Za-z0-9_.-]+$/;

function findDuplicate(names: string[]): string | undefined {
  return names.find(
    (candidateName, nameIndex) => names.indexOf(candidateName) !== nameIndex,
  );
}

/** A problem with name rows (credentials, redirect fields, headers), or undefined. */
function findNameRowsError(
  names: string[],
  rowLabel: string,
): string | undefined {
  if (names.some((rowName) => rowName.trim() === "")) {
    return `Every ${rowLabel} needs a name`;
  }
  const badName = names.find((rowName) => !fieldNamePattern.test(rowName));
  if (badName !== undefined) {
    return `${badName} is not a valid name: use letters, digits, _, . or -`;
  }
  const duplicateName = findDuplicate(
    names.map((rowName) => rowName.toLowerCase()),
  );

  return duplicateName === undefined
    ? undefined
    : `${duplicateName} appears twice`;
}

/** The key and name of a new gateway (PY-12.2). */
export function validateNewGateway(
  gatewayKey: string,
  gatewayName: string,
  existingGateways: Pick<PaymentGatewayDefinition, "key">[],
): PaymentGatewayFieldErrors {
  const fieldErrors: PaymentGatewayFieldErrors = {};
  if (!gatewayKeyPattern.test(gatewayKey)) {
    fieldErrors.key =
      "Use 2 to 32 lowercase letters, digits or _, starting with a letter";
  } else if (
    existingGateways.some(
      (existingGateway) => existingGateway.key === gatewayKey,
    )
  ) {
    fieldErrors.key = `A gateway with the key ${gatewayKey} already exists`;
  }
  if (gatewayName.trim() === "") {
    fieldErrors.name = "Enter a name";
  }

  return fieldErrors;
}

/**
 * Rules for a gateway, shared by the Gateways screen and the API (PY-12.2).
 * Template problems come from the preview, which renders them (PY-12.4).
 */
export function validatePaymentGateway(
  gatewayInput: PaymentGatewayInput,
): PaymentGatewayFieldErrors {
  const fieldErrors: PaymentGatewayFieldErrors = {};
  if (gatewayInput.name.trim() === "") {
    fieldErrors.name = "Enter a name";
  }
  if (!/^#[0-9a-f]{6}$/i.test(gatewayInput.accent)) {
    fieldErrors.accent = "Use a colour like #1e5bb8";
  }
  if (gatewayInput.method_keys.length === 0) {
    fieldErrors.method_keys = "Offer at least one method";
  } else if (findDuplicate(gatewayInput.method_keys) !== undefined) {
    fieldErrors.method_keys = "Each method is offered once";
  }
  fieldErrors.credentials = findNameRowsError(
    gatewayInput.credentials.map((credential) => credential.name),
    "credential",
  );
  fieldErrors.redirect_fields = findNameRowsError(
    gatewayInput.redirect_fields.map((redirectField) => redirectField.name),
    "redirect field",
  );
  fieldErrors.notification_headers = findNameRowsError(
    gatewayInput.notification_headers.map(
      (headerTemplate) => headerTemplate.name,
    ),
    "header",
  );

  return Object.fromEntries(
    Object.entries(fieldErrors).filter(
      ([, fieldError]) => fieldError !== undefined,
    ),
  ) as PaymentGatewayFieldErrors;
}
