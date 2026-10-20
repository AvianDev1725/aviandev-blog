export type FieldError = { field: string; message: string };

type Result<T> = { ok: true; data: T } | { ok: false; error: string; details: FieldError[] };

async function callApi<T>(method: string, path: string, body?: unknown): Promise<Result<T>> {
  try {
    const res = await fetch(`/api${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return {
        ok: false,
        error: data.details?.[0]?.message ?? data.error ?? '',
        details: data.details ?? [],
      };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, error: '', details: [] };
  }
}

export const postJson = <T = unknown>(path: string, body: unknown) => callApi<T>('POST', path, body);
export const putJson = <T = unknown>(path: string, body: unknown) => callApi<T>('PUT', path, body);
export const patchJson = <T = unknown>(path: string, body: unknown) => callApi<T>('PATCH', path, body);
export const deleteJson = <T = unknown>(path: string) => callApi<T>('DELETE', path);

export async function uploadFile(file: File): Promise<Result<{ url: string }>> {
  try {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/media', { method: 'POST', body: form });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error ?? '', details: [] };
    return { ok: true, data };
  } catch {
    return { ok: false, error: '', details: [] };
  }
}