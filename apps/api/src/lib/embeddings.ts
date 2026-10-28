import { createHash } from 'node:crypto';

export const EMBEDDING_DIMENSIONS = 384;

const MODEL = 'Xenova/bge-small-en-v1.5';
const QUERY_PREFIX = 'Represent this sentence for searching relevant passages: ';
const BATCH_SIZE = 16;

type Embedder = (texts: string[]) => Promise<number[][]>;

const usePretendModel = process.env.NODE_ENV === 'test' || process.env.EMBEDDINGS === 'fake';

let realModel: Promise<Embedder> | null = null;

function loadRealModel(): Promise<Embedder> {
  realModel ??= (async () => {
    const { env, pipeline } = await import('@huggingface/transformers');
    env.cacheDir = process.env.MODEL_CACHE_DIR ?? '.cache/models';

    const extract = await pipeline('feature-extraction', MODEL, { dtype: 'q8' });
    return async (texts: string[]) => {
      const output = await extract(texts, { pooling: 'cls', normalize: true });
      return output.tolist() as number[][];
    };
  })().catch((error) => {
    realModel = null;
    throw error;
  });
  return realModel;
}

function normalize(vector: number[]) {
  const length = Math.hypot(...vector) || 1;
  return vector.map((value) => value / length);
}

function pretendEmbedding(text: string) {
  const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  for (const word of text.toLowerCase().match(/[a-z0-9]+/g) ?? []) {
    const digest = createHash('md5').update(word).digest();
    vector[digest.readUInt16BE(0) % EMBEDDING_DIMENSIONS] += 1;
  }
  return normalize(vector);
}

async function embed(texts: string[]) {
  if (texts.length === 0) return [];
  if (usePretendModel) return texts.map(pretendEmbedding);

  const model = await loadRealModel();
  const vectors: number[][] = [];
  for (let start = 0; start < texts.length; start += BATCH_SIZE) {
    vectors.push(...(await model(texts.slice(start, start + BATCH_SIZE))));
  }
  return vectors;
}

export function embedDocuments(texts: string[]) {
  return embed(texts);
}

export async function embedQuery(text: string) {
  const [vector] = await embed([usePretendModel ? text : `${QUERY_PREFIX}${text}`]);
  return vector;
}

export function warmUpEmbeddings() {
  if (usePretendModel) return;
  loadRealModel().catch((error) => console.error('[embeddings] model failed to load:', error));
}