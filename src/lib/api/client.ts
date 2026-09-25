import { env } from '@/config/env';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  timeoutMs?: number;
}

/** Thin fetch wrapper: base URL, JSON, timeout, abort and typed errors. */
export async function request<T>(
  path: string,
  { body, timeoutMs = 15_000, signal, headers, ...init }: RequestOptions = {},
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new DOMException('Request timed out', 'TimeoutError')), timeoutMs);
  signal?.addEventListener('abort', () => controller.abort(signal.reason), { once: true });

  try {
    const res = await fetch(`${env.apiBaseUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const data = res.status === 204 ? undefined : await res.json().catch(() => undefined);
    if (!res.ok) {
      const message = (data as { message?: string } | undefined)?.message ?? `Request failed (${res.status})`;
      throw new ApiError(message, res.status, data);
    }
    return data as T;
  } finally {
    clearTimeout(timeout);
  }
}
