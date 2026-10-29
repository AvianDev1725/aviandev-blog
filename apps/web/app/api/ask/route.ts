import type { NextRequest } from 'next/server';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';

export async function POST(request: NextRequest) {
  let upstream: Response;
  try {
    upstream = await fetch(`${API_URL}/ask`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': request.headers.get('user-agent') ?? '',
        'x-forwarded-for': request.headers.get('x-forwarded-for') ?? '',
      },
      body: await request.text(),
      signal: request.signal,
      cache: 'no-store',
    });
  } catch {
    return Response.json({ error: 'Could not reach the API', code: 'network' }, { status: 502 });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') ?? 'application/json',
      'cache-control': 'no-cache, no-transform',
      'x-accel-buffering': 'no',
    },
  });
}