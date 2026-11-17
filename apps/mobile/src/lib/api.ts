/**
 * The one way the app talks to Nodo: `/api/m/v1` on the root domain, with the
 * session in `Authorization` and the company in `X-Nodo-Company`.
 *
 * The server answers refusals as codes, never sentences (`invalid_credentials`,
 * `403 no_access`, field errors as `validation.*` keys), so `ApiError` carries
 * the code and the screen translates it. A request that never got an answer is
 * `network`, which is its own case on a building site rather than a failure.
 */

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "https://crm.nodo.co.nz").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly fields: Record<string, string[]> = {},
    public readonly extra: Record<string, unknown> = {},
  ) {
    super(code);
    this.name = "ApiError";
  }
}

export type Auth = { token: string; company?: string | null };

type Options = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  auth?: Auth | null;
  signal?: AbortSignal;
};

export async function api<T>(path: string, { method = "GET", body, auth, signal }: Options = {}): Promise<T> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (auth) headers.authorization = `Bearer ${auth.token}`;
  if (auth?.company) headers["x-nodo-company"] = auth.company;

  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/m/v1${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error;
    throw new ApiError(0, "network");
  }

  const json = await response.json().catch(() => null);
  if (response.ok) return json as T;
  throw toApiError(response.status, json);
}

/** Pure, so the shapes the server refuses with are checked without a network. */
export function toApiError(status: number, json: unknown): ApiError {
  if (json && typeof json === "object" && typeof (json as { error?: unknown }).error === "string") {
    const { error, fields, ...extra } = json as { error: string; fields?: Record<string, string[]> };
    return new ApiError(status, error, fields ?? {}, extra);
  }
  return new ApiError(status, status >= 500 ? "server_error" : "unknown");
}
