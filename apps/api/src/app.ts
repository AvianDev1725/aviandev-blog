import { Hono } from 'hono';
import { requireAuth, requireRole, type AuthEnv, type SessionUser } from './middleware/auth.js';
import { createPostSchema, updatePostSchema } from './schemas/post.js';
import {
  getPublishedPosts,
  getPublishedPostBySlug,
  createPost,
  updatePost,
  deletePost,
  getPostById,
  findMissingCategories
} from './data/posts.js';
import categoriesRoute from './routes/categories.js';
import { validateJson } from './lib/validate.js';
import { handleError } from './lib/error.js';
import auth from './routes/auth.js';
import usersRoute from './routes/users.js';
import invitationsRoute from './routes/invitations.js';
import contentModelsRoute from './routes/content-models.js';
import contentRoute from './routes/content.js';
import fragmentsRoute from './routes/content-fragments.js';
import { canEditPost } from './lib/permissions.js';
import adminPostsRoute from './routes/admin-posts.js';
import { notifyPostsChanged } from './lib/revalidate.js';
import mediaRoute from './routes/media.js';
import previewRoute from './routes/preview.js';

const app = new Hono<AuthEnv>();

const canWrite = [requireAuth, requireRole('admin', 'super_admin')] as const;

app.route('/auth', auth);

app.route('/users', usersRoute);

app.route('/invitations', invitationsRoute);

app.route('/categories', categoriesRoute);

app.route('/content-models', contentModelsRoute);
app.route('/content', contentRoute);
app.route('/content-fragments', fragmentsRoute);

app.route('/admin/posts', adminPostsRoute);

app.route('/media', mediaRoute);

app.route('/preview', previewRoute);

app.get('/', (c) => c.text('Hello Hono!'));

app.get('/health', (c) => c.json({ status: 'ok' }));

app.get('/posts', async (c) => c.json(await getPublishedPosts(c.req.query('category'))));

app.get('/posts/:slug', async (c) => {
  const post = await getPublishedPostBySlug(c.req.param('slug'));
  if (!post) return c.json({ error: 'Post not found' }, 404);
  return c.json(post);
});

app.post('/posts', ...canWrite, validateJson(createPostSchema), async (c) => {
  const body = c.req.valid('json');
  const missing = await findMissingCategories(body.categoryIds);
  if (missing.length > 0) return c.json({ error: `Unknown category: ${missing.join(', ')}` }, 400);
  const post = await createPost({ ...body, authorId: c.get('user').id });
  if (post.published) notifyPostsChanged([post.slug]);
  return c.json(post, 201);
});

app.patch('/posts/:id', ...canWrite, validateJson(updatePostSchema), async (c) => {
  const id = Number(c.req.param('id'));
  if (Number.isNaN(id)) return c.json({ error: 'Invalid id' }, 400);

  const existing = await getPostById(id);
  if (!existing) return c.json({ error: 'Post not found' }, 404);
  if (!canEditPost(c.get('user'), existing)) return c.json({ error: 'Forbidden' }, 403);

  const body = c.req.valid('json');
  if (body.categoryIds) {
    const missing = await findMissingCategories(body.categoryIds);
    if (missing.length > 0) return c.json({ error: `Unknown category: ${missing.join(', ')}` }, 400);
  }

  const post = await updatePost(id, body);
  if (existing.published || post.published) notifyPostsChanged([existing.slug, post.slug]);
  return c.json(post);
});

app.delete('/posts/:id', ...canWrite, async (c) => {
  const id = Number(c.req.param('id'));
  if (Number.isNaN(id)) return c.json({ error: 'Invalid id' }, 400);

  const existing = await getPostById(id);
  if (!existing) return c.json({ error: 'Post not found' }, 404);
  if (!canEditPost(c.get('user'), existing)) return c.json({ error: 'Forbidden' }, 403);

  await deletePost(id);
  if (existing.published) notifyPostsChanged([existing.slug]);
  return c.body(null, 204);
});

app.onError(handleError);
app.notFound((c) => c.json({ error: 'Route not found' }, 404));

export default app;