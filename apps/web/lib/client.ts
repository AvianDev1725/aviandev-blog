export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; fields: Record<string, string> };

async function callApi<T>(method: string, path: string, body?: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`/api${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = res.status === 204 ? null : await res.json().catch(() => null);
    if (res.ok) return { ok: true, data: data as T };

    const details = data?.details;
    const fields = details && typeof details === 'object' && !Array.isArray(details) ? details : {};
    return { ok: false, error: typeof data?.error === 'string' ? data.error : '', fields };
  } catch {
    return { ok: false, error: '', fields: {} };
  }
}

export const postApi = <T = unknown>(path: string, body?: unknown) => callApi<T>('POST', path, body);
export const patchApi = <T = unknown>(path: string, body: unknown) => callApi<T>('PATCH', path, body);
export const deleteApi = (path: string) => callApi<null>('DELETE', path);

export function safeNext(path: string | null) {
  return path && path.startsWith('/') && !path.startsWith('//') ? path : '/';
}

export type SessionUser = {
  id: number;
  name: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  role: 'reader' | 'admin' | 'super_admin';
  emailVerifiedAt: string | null;
};

let sessionRequest: Promise<SessionUser | null> | null = null;

export function getSession() {
  sessionRequest ??= fetch('/api/auth/session', { cache: 'no-store' })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => (data?.user ?? null) as SessionUser | null)
    .catch(() => null);
  return sessionRequest;
}