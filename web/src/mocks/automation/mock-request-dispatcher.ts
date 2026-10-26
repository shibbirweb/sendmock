import { getResponse, type RequestHandler } from "msw";

let registeredHandlers: RequestHandler[] = [];

/** The handlers scenario steps are answered by; set when the mock API starts. */
export function registerMockRequestHandlers(mockHandlers: RequestHandler[]) {
  registeredHandlers = mockHandlers;
}

/** Answers a request with the mock handlers directly, without the network. */
export async function dispatchMockRequest(request: Request): Promise<Response> {
  const response = await getResponse(registeredHandlers, request);

  return (
    response ??
    Response.json(
      { error: { code: "not_found", message: "No such operation" } },
      { status: 404 },
    )
  );
}
