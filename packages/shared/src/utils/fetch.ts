import { RequestOptions } from '../types/api.js';

export interface FetchOptions extends RequestOptions {
  headers?: Record<string, string>;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: string | FormData;
}

export class FetchError extends Error {
  constructor(
    message: string,
    public status?: number,
    public response?: Response
  ) {
    super(message);
    this.name = 'FetchError';
  }
}

export async function safeFetch(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const {
    timeout = 30000,
    retries = 3,
    retryDelay = 1000,
    headers = {},
    method = 'GET',
    body,
  } = options;

  let lastError: Error;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method,
        headers: {
          'User-Agent': 'metafin/0.1.0',
          ...headers,
        },
        body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new FetchError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          response
        );
      }

      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (error instanceof FetchError && error.status) {
        // Don't retry client errors (4xx)
        if (error.status >= 400 && error.status < 500) {
          throw error;
        }

        // Apply exponential backoff for server errors (5xx) and rate limits (429)
        if (
          (error.status >= 500 || error.status === 429) &&
          attempt < retries
        ) {
          const backoffDelay =
            retryDelay * Math.pow(2, attempt) + Math.random() * 1000;
          await sleep(backoffDelay);
          continue;
        }
      }

      // Retry network errors
      if (
        attempt < retries &&
        error instanceof Error &&
        (error.name === 'AbortError' || error.message.includes('fetch'))
      ) {
        const backoffDelay =
          retryDelay * Math.pow(2, attempt) + Math.random() * 1000;
        await sleep(backoffDelay);
        continue;
      }

      throw error;
    }
  }

  throw lastError!;
}

export async function safeFetchJson<T = unknown>(
  url: string,
  options: FetchOptions = {}
): Promise<T> {
  const response = await safeFetch(url, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...options.headers,
    },
  });

  const text = await response.text();
  if (!text) {
    throw new FetchError('Empty response body');
  }

  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new FetchError('Invalid JSON response', response.status, response);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
