import { ProviderUnavailableError } from '../../domain/errors';

export interface JsonResponse {
  status: number;
  body: unknown;
}

export interface RequestJsonOptions {
  timeoutMs?: number;
  /** How many times to try again after a 5xx or a network error. */
  retries?: number;
  fetchImpl?: typeof fetch;
}

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_RETRIES = 1;

/**
 * Calls an HTTP API and parses JSON. It has a timeout, retries once on 5xx or network
 * errors, and turns a final failure into ProviderUnavailableError (HTTP 502).
 * 4xx answers are returned to the caller, because they often mean something specific.
 */
export async function requestJson(url: string, init: RequestInit, options: RequestJsonOptions = {}): Promise<JsonResponse> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries = options.retries ?? DEFAULT_RETRIES;
  const fetchImpl = options.fetchImpl ?? fetch;

  let lastFailure = 'unknown error';
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
      if (response.status >= 500) {
        lastFailure = `HTTP ${response.status} from ${new URL(url).host}`;
        continue;
      }
      return { status: response.status, body: await parseBody(response) };
    } catch (error) {
      lastFailure = error instanceof Error ? `${error.name}: ${error.message}` : 'request failed';
    }
  }
  throw new ProviderUnavailableError(lastFailure);
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  try {
    return text === '' ? null : JSON.parse(text);
  } catch {
    return null;
  }
}
