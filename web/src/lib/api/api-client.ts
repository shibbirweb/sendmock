import type { ApiErrorBody } from "@/lib/api/types";

/** Base URL of the mss server; empty means the same origin as the UI. */
const apiBaseUrl = `${import.meta.env.VITE_API_BASE_URL ?? ""}/api/v1`;

export class ApiError extends Error {
  readonly statusCode: number;
  readonly errorCode: string;
  readonly fieldName: string | null;

  constructor(statusCode: number, errorBody: ApiErrorBody | null) {
    super(
      errorBody?.error.message ?? `Request failed with status ${statusCode}`,
    );
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.errorCode = errorBody?.error.code ?? "unknown_error";
    this.fieldName = errorBody?.error.field ?? null;
  }
}

type QueryParameterValue = string | number | boolean | undefined | null;

type ApiRequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  queryParameters?: Record<string, QueryParameterValue>;
  requestBody?: unknown;
  abortSignal?: AbortSignal;
};

function buildRequestUrl(
  apiPath: string,
  queryParameters: Record<string, QueryParameterValue> = {},
): string {
  const searchParameters = new URLSearchParams();

  for (const [parameterName, parameterValue] of Object.entries(
    queryParameters,
  )) {
    if (parameterValue !== undefined && parameterValue !== null) {
      searchParameters.set(parameterName, String(parameterValue));
    }
  }

  const queryString = searchParameters.toString();

  return `${apiBaseUrl}${apiPath}${queryString ? `?${queryString}` : ""}`;
}

async function readErrorBody(response: Response): Promise<ApiErrorBody | null> {
  try {
    return (await response.json()) as ApiErrorBody;
  } catch {
    return null;
  }
}

/** Calls the mss REST API and returns the parsed JSON, or throws ApiError. */
export async function requestApi<ResponseType>(
  apiPath: string,
  requestOptions: ApiRequestOptions = {},
): Promise<ResponseType> {
  const hasRequestBody = requestOptions.requestBody !== undefined;
  const response = await fetch(
    buildRequestUrl(apiPath, requestOptions.queryParameters),
    {
      method: requestOptions.method ?? "GET",
      headers: hasRequestBody ? { "Content-Type": "application/json" } : {},
      body: hasRequestBody
        ? JSON.stringify(requestOptions.requestBody)
        : undefined,
      signal: requestOptions.abortSignal,
    },
  );

  if (!response.ok) {
    throw new ApiError(response.status, await readErrorBody(response));
  }

  if (response.status === 204) {
    return undefined as ResponseType;
  }

  return (await response.json()) as ResponseType;
}

/** WebSocket URL of the realtime event stream. */
export function buildRealtimeUrl(): string {
  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL;
  const httpBaseUrl =
    configuredBaseUrl ?? `${window.location.origin}${import.meta.env.BASE_URL}`;
  const realtimeUrl = new URL("api/v1/ws", httpBaseUrl.replace(/\/?$/, "/"));
  realtimeUrl.protocol = realtimeUrl.protocol === "https:" ? "wss:" : "ws:";

  return realtimeUrl.toString();
}
