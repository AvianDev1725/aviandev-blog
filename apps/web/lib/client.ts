export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: string; status: number; fields: Record<string, string> };

/**
 * Turns the API's validation details into { field: message }.
 * Understands { password: 'msg' }, { password: ['msg'] },
 * { fieldErrors: { password: ['msg'] } } and [{ path: ['password'], message: 'msg' }].
 */
function toFields(details: unknown): Record<string, string> {
  const fields: Record<string, string> = {};
  if (!details || typeof details !== 'object') return fields;

  if (Array.isArray(details)) {
    for (const issue of details) {
      const name = Array.isArray(issue?.path) ? issue.path[0] : undefined;
      if (typeof name === 'string' && typeof issue?.message === 'string' && !fields[name]) fields[name] = issue.message;
    }
    return fields;
  }

  const source = 'fieldErrors' in details ? (details as { fieldErrors: unknown }).fieldErrors : details;
  if (!source || typeof source !== 'object') return fields;

  for (const [name, value] of Object.entries(source)) {
    const message = Array.isArray(value) ? value.find((item) => typeof item === 'string') : value;
    if (typeof message === 'string' && message) fields[name] = message;
  }
  return fields;
}

async function callApi<T>(method: string, path: string, body?: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`/api${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = res.status === 204 ? null : await res.json().catch(() => null);
    if (res.ok) return { ok: true, data: data as T };

    return {
      ok: false,
      error: typeof data?.error === 'string' ? data.error : '',
      code: typeof data?.code === 'string' ? data.code : '',
      status: res.status,
      fields: toFields(data?.details),
    };
  } catch {
    return { ok: false, error: '', code: '', status: 0, fields: {} };
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