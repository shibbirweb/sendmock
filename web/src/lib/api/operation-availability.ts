import { buildOperationId } from "@/lib/api/endpoint-registry/operation-id";
import type { AppInfo } from "@/lib/api/types";

/**
 * Whether the running binary serves an operation (UI-12): `whenUnknown` before /info
 * answers, and true for a server that does not report `available_operations`.
 */
export function isOperationServed(
  appInfo: AppInfo | undefined,
  operationKey: string,
  whenUnknown: boolean,
): boolean {
  if (appInfo === undefined) {
    return whenUnknown;
  }
  const servedOperationIds = appInfo.available_operations;
  if (servedOperationIds === undefined) {
    return true;
  }
  const [method = "", path = ""] = operationKey.split(" ");

  return servedOperationIds.includes(buildOperationId(method, path));
}
