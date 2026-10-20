export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; fields: Record<string, string> };

export async function postApi<T = unknown>(path: string, body?: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`/api${path}`, {
      method: 'POST',
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

export function safeNext(path: string | null) {
  return path && path.startsWith('/') && !path.startsWith('//') ? path : '/';
}