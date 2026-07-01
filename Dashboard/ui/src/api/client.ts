export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function formatHttpError(status: number, statusText: string, bodyError?: string): string {
  if (bodyError) return bodyError;
  if (status === 502 || status === 503) {
    return (
      "API unreachable. Start the backend with: " +
      "cd Dashboard/api && npm run dev (or ./Dashboard/dev.sh)"
    );
  }
  return statusText || `Request failed (${status})`;
}

async function parseErrorResponse(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return formatHttpError(res.status, res.statusText, body.error);
  } catch {
    return formatHttpError(res.status, res.statusText);
  }
}

function wrapNetworkError(err: unknown): never {
  if (err instanceof ApiError) throw err;
  throw new ApiError(
    "Cannot reach the API. Start the backend: cd Dashboard/api && npm run dev",
    0,
  );
}

export async function apiGet<T>(path: string): Promise<T> {
  try {
    const res = await fetch(path);
    if (!res.ok) {
      throw new ApiError(await parseErrorResponse(res), res.status);
    }
    return res.json() as Promise<T>;
  } catch (err) {
    wrapNetworkError(err);
  }
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorResponse(res), res.status);
    }
    return res.json() as Promise<T>;
  } catch (err) {
    wrapNetworkError(err);
  }
}
