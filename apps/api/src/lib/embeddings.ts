import { createHash } from 'node:crypto';

export const EMBEDDING_DIMENSIONS = 384;

const LOCAL_MODEL = 'Xenova/bge-small-en-v1.5';
const CLOUDFLARE_MODEL = '@cf/baai/bge-small-en-v1.5';
const QUERY_PREFIX = 'Represent this sentence for searching relevant passages: ';
const LOCAL_BATCH = 16;
const CLOUDFLARE_BATCH = 50;
const TIMEOUT_MS = 15_000;

type Embedder = (texts: string[]) => Promise<number[][]>;
type Provider = 'local' | 'cloudflare' | 'fake';

/**
 * Which model makes the search vectors. Set EMBEDDINGS in .env:
 * - local: runs the model on this machine (your Mac). Too large for Vercel.
 * - cloudflare: the same model hosted by Cloudflare Workers AI (production, free tier).
 * - fake: a quick stand-in for tests.
 * Documents and searches must use the same provider. After switching, re-index posts.
 */
function provider(): Provider {
  if (process.env.NODE_ENV === 'test') return 'fake';
  const chosen = process.env.EMBEDDINGS?.trim().toLowerCase();
  return chosen === 'cloudflare' || chosen === 'fake' ? chosen : 'local';
}

function normalize(vector: number[]) {
  const length = Math.hypot(...vector) || 1;
  return vector.map((value) => value / length);
}

/* ---------- Local model (your Mac) ---------- */

// Loaded by name so Vercel doesn't bundle this large library into the API.
const LOCAL_LIBRARY = '@huggingface/transformers';
let localModel: Promise<Embedder> | null = null;

function loadLocalModel(): Promise<Embedder> {
  localModel ??= (async () => {
    const { env, pipeline } = (await import(/* @vite-ignore */ LOCAL_LIBRARY)) as typeof import('@huggingface/transformers');
    env.cacheDir = process.env.MODEL_CACHE_DIR ?? '.cache/models';

    const extract = await pipeline('feature-extraction', LOCAL_MODEL, { dtype: 'q8' });
    return async (texts: string[]) => {
      const output = await extract(texts, { pooling: 'cls', normalize: true });
      return output.tolist() as number[][];
    };
  })().catch((error) => {
    localModel = null;
    throw error;
  });
  return localModel;
}

/* ---------- Cloudflare Workers AI (production) ---------- */

async function cloudflareEmbed(texts: string[]): Promise<number[][]> {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_AI_TOKEN;
  if (!account || !token) throw new Error('CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_AI_TOKEN must be set for EMBEDDINGS=cloudflare');

  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${CLOUDFLARE_MODEL}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: texts }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Cloudflare embeddings failed: ${res.status}`);

  const body = (await res.json()) as { success?: boolean; result?: { data?: number[][] } };
  const data = body.result?.data;
  if (!body.success || !Array.isArray(data) || data.length !== texts.length) {
    throw new Error('Cloudflare embeddings returned an unexpected response');
  }
  return data.map((vector) => {
    if (vector.length !== EMBEDDING_DIMENSIONS) throw new Error(`Expected ${EMBEDDING_DIMENSIONS} dimensions, got ${vector.length}`);
    return normalize(vector);
  });
}

/* ---------- Test stand-in ---------- */

function pretendEmbedding(text: string) {
  const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  for (const word of text.toLowerCase().match(/[a-z0-9]+/g) ?? []) {
    const digest = createHash('md5').update(word).digest();
    vector[digest.readUInt16BE(0) % EMBEDDING_DIMENSIONS] += 1;
  }
  return normalize(vector);
}

/* ---------- Shared ---------- */

async function embed(texts: string[]) {
  if (texts.length === 0) return [];
  const source = provider();
  if (source === 'fake') return texts.map(pretendEmbedding);

  const batchSize = source === 'cloudflare' ? CLOUDFLARE_BATCH : LOCAL_BATCH;
  const run: Embedder = source === 'cloudflare' ? cloudflareEmbed : await loadLocalModel();

  const vectors: number[][] = [];
  for (let start = 0; start < texts.length; start += batchSize) {
    vectors.push(...(await run(texts.slice(start, start + batchSize))));
  }
  return vectors;
}

export function embedDocuments(texts: string[]) {
  return embed(texts);
}

export async function embedQuery(text: string) {
  const [vector] = await embed([provider() === 'fake' ? text : `${QUERY_PREFIX}${text}`]);
  return vector;
}

export function warmUpEmbeddings() {
  if (provider() !== 'local') return;
  loadLocalModel().catch((error) => console.error('[embeddings] model failed to load:', error));
}