import { serve } from '@hono/node-server';
import app from './app.js';
import { warmUpEmbeddings } from './lib/embeddings.js';

// Vercel runs the exported app itself.
export default app;

// On your Mac (and any normal server) we start the server ourselves.
if (!process.env.VERCEL) {
  const port = Number(process.env.PORT) || 3000;
  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
    warmUpEmbeddings();
  });
}