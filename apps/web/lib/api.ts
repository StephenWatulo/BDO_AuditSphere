import { buildQuery } from '@/lib/utils';

export const API_BASE = '/api/v1';

export interface GuardResult {
  guard: string;
  message: string;
}

export class ApiError extends Error {
  status: number;
  guards?: GuardResult[];
  requestId?: string;
  details?: unknown;

  constructor(status: number, message: string, extra?: { guards?: GuardResult[]; requestId?: string; details?: unknown }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.guards = extra?.guards;
    this.requestId = extra?.requestId;
    this.details = extra?.details;
  }

  get isGuardFailure() {
    return this.status === 422 && Array.isArray(this.guards) && this.guards.length > 0;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

export function errorMessage(e: unknown, fallback = 'Something went wrong'): string {
  if (isApiError(e)) return e.message || fallback;
  if (e instanceof Error) return e.message || fallback;
  return fallback;
}

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

interface RequestOptions {
  responseType?: 'blob';
  params?: Record<string, unknown>;
  /** When true the body is sent as-is (FormData / Blob). */
  raw?: boolean;
  signal?: AbortSignal;
  /** Skip the refresh-and-retry dance (used for auth endpoints). */
  noRefresh?: boolean;
  headers?: Record<string, string>;
}

let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => {
        setTimeout(() => {
          refreshPromise = null;
        }, 0);
      });
  }
  return refreshPromise;
}

function redirectToSignIn() {
  if (typeof window === 'undefined') return;
  const path = window.location.pathname + window.location.search;
  if (path.startsWith('/sign-in') || path.startsWith('/mfa')) return;
  const url = new URL('/sign-in', window.location.origin);
  if (path !== '/') url.searchParams.set('returnTo', path);
  window.location.assign(url.toString());
}

async function parseError(res: Response): Promise<ApiError> {
  let payload: Record<string, unknown> | null = null;
  try {
    payload = (await res.json()) as Record<string, unknown>;
  } catch {
    payload = null;
  }
  const rawMessage = payload?.message;
  const message = Array.isArray(rawMessage)
    ? rawMessage.join('; ')
    : typeof rawMessage === 'string'
      ? rawMessage
      : res.statusText || `Request failed (${res.status})`;
  const guards = Array.isArray(payload?.guards) ? (payload!.guards as GuardResult[]) : undefined;
  const requestId =
    (typeof payload?.requestId === 'string' ? payload.requestId : undefined) ??
    res.headers.get('x-request-id') ??
    undefined;
  return new ApiError(res.status, message, { guards, requestId, details: payload });
}

async function request<T>(method: Method, path: string, body?: unknown, opts: RequestOptions = {}): Promise<T> {
  const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}${buildQuery(opts.params)}`;
  const headers: Record<string, string> = { Accept: 'application/json', ...(opts.headers ?? {}) };
  let payload: BodyInit | undefined;
  if (body !== undefined) {
    if (opts.raw) {
      payload = body as BodyInit;
    } else {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
  }

  const doFetch = () =>
    fetch(url, {
      method,
      headers,
      body: payload,
      credentials: 'include',
      signal: opts.signal,
      cache: 'no-store',
    });

  let res = await doFetch();

  if (res.status === 401 && !opts.noRefresh && !path.startsWith('/auth/')) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      res = await doFetch();
    }
    if (res.status === 401) {
      redirectToSignIn();
      throw new ApiError(401, 'Your session has expired. Please sign in again.');
    }
  }

  if (!res.ok) {
    throw await parseError(res);
  }

  if (opts.responseType === 'blob') return {
    blob: await res.blob(),
    disposition: res.headers.get('x-download-disposition') ?? res.headers.get('content-disposition'),
  } as T;

  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T;
  }
  const text = await res.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

export const api = {
  download: async (path: string, params?: Record<string, unknown>, fallbackName = 'report.pdf') => {
    // A successful HTTP status alone does not guarantee that a file arrived.
    // Retry an incomplete response once, without saving a broken local file.
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await request<{ blob: Blob; disposition: string | null }>('GET', path, undefined, { params, responseType: 'blob', headers: { Accept: '*/*', 'X-Download-Mode': 'browser' } });
      const encoded = result.disposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
      const plain = result.disposition?.match(/filename="([^"]+)"/i)?.[1];
      const fileName = encoded ? decodeURIComponent(encoded) : plain ?? fallbackName;
      let invalid = result.blob.size === 0;
      if (!invalid && (/\.pdf$/i.test(fileName) || /\.pdf$/i.test(fallbackName) || result.blob.type === 'application/pdf')) {
        const head = await result.blob.slice(0, 1024).text();
        const tail = await result.blob.slice(-1024).text();
        invalid = !head.includes('%PDF-') || !tail.includes('%%EOF');
      }
      if (invalid) {
        if (attempt === 0) continue;
        throw new ApiError(502, 'The server returned an empty or incomplete file. Please try downloading again.');
      }
      const url = URL.createObjectURL(result.blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      return;
    }
  },
  get: <T>(path: string, params?: Record<string, unknown>, opts?: Omit<RequestOptions, 'params'>) =>
    request<T>('GET', path, undefined, { ...opts, params }),
  post: <T>(path: string, body?: unknown, opts?: RequestOptions) => request<T>('POST', path, body, opts),
  patch: <T>(path: string, body?: unknown, opts?: RequestOptions) => request<T>('PATCH', path, body, opts),
  put: <T>(path: string, body?: unknown, opts?: RequestOptions) => request<T>('PUT', path, body, opts),
  delete: <T>(path: string, opts?: RequestOptions) => request<T>('DELETE', path, undefined, opts),
  /** Multipart upload helper. */
  upload: <T>(path: string, form: FormData, opts?: RequestOptions) =>
    request<T>('POST', path, form, { ...opts, raw: true }),
};
