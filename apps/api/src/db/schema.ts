import { sql } from 'drizzle-orm';
import {
  pgTable,
  pgEnum,
  serial,
  text,
  boolean,
  timestamp,
  integer,
  jsonb,
  type AnyPgColumn,
  primaryKey,
  date,
  index,
  uniqueIndex,
  vector,
} from 'drizzle-orm/pg-core';
import type { FieldDefinition } from '../content/field-types.js';

export const userRole = pgEnum('user_role', ['reader', 'admin', 'super_admin']);
export const userStatus = pgEnum('user_status', ['pending', 'active', 'rejected']);
export const tokenPurpose = pgEnum('token_purpose', ['verify_email', 'reset_password']);
export const commentStatus = pgEnum('comment_status', ['pending', 'approved', 'spam']);

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  emailVerifiedAt: timestamp('email_verified_at'),
  passwordHash: text('password_hash').notNull(),
  role: userRole('role').notNull().default('reader'),
  status: userStatus('status').notNull().default('pending'),
  reviewedBy: integer('reviewed_by').references((): AnyPgColumn => users.id, { onDelete: 'set null' }),
  reviewedAt: timestamp('reviewed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  bannedAt: timestamp('banned_at'),
});

export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  excerpt: text('excerpt').notNull().default(''),
  seoTitle: text('seo_title').notNull().default(''),
  seoDescription: text('seo_description').notNull().default(''),
  shareImage: text('share_image').notNull().default(''),
  noindex: boolean('noindex').notNull().default(false),
  content: jsonb('content')
    .notNull()
    .default(sql`'{"type":"doc","content":[]}'::jsonb`),
  published: boolean('published').notNull().default(false),
  publishedAt: timestamp('published_at'),
  authorId: integer('author_id').references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at')
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  readingMinutes: integer('reading_minutes').notNull().default(1),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const invitations = pgTable('invitations', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  role: userRole('role').notNull(),
  invitedBy: integer('invited_by')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at').notNull(),
  acceptedAt: timestamp('accepted_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  slug: text('slug').notNull().unique(),
  description: text('description').notNull().default(''),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at')
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const postCategories = pgTable(
  'post_categories',
  {
    postId: integer('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    categoryId: integer('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.postId, table.categoryId] })]
);

export const contentModels = pgTable('content_models', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  fields: jsonb('fields').$type<FieldDefinition[]>().notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at')
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const contentFragments = pgTable('content_fragments', {
  key: text('key').primaryKey(),
  modelId: integer('model_id')
    .notNull()
    .references(() => contentModels.id, { onDelete: 'restrict' }),
  data: jsonb('data').$type<Record<string, unknown>>().notNull(),
  updatedBy: integer('updated_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at')
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const media = pgTable('media', {
  id: text('id').primaryKey(),
  filename: text('filename').notNull(),
  mimeType: text('mime_type').notNull(),
  size: integer('size').notNull(),
  data: text('data'),
  uploadedBy: integer('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const postViews = pgTable(
  'post_views',
  {
    postId: integer('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    day: date('day').notNull(),
    views: integer('views').notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.postId, table.day] })],
);

export const viewVisitors = pgTable(
  'view_visitors',
  {
    hash: text('hash').primaryKey(),
    day: date('day').notNull(),
  },
  (table) => [index('view_visitors_day_idx').on(table.day)],
);

export const userTokens = pgTable('user_tokens', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  purpose: tokenPurpose('purpose').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const comments = pgTable(
  'comments',
  {
    id: serial('id').primaryKey(),
    postId: integer('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    parentId: integer('parent_id').references((): AnyPgColumn => comments.id, { onDelete: 'cascade' }),
    userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
    guestAvatar: text('guest_avatar'),
    body: text('body').notNull(),
    status: commentStatus('status').notNull().default('pending'),
    editedAt: timestamp('edited_at'),
    deletedAt: timestamp('deleted_at'),
    moderatedBy: integer('moderated_by').references(() => users.id, { onDelete: 'set null' }),
    moderatedAt: timestamp('moderated_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('comments_post_status_idx').on(table.postId, table.status, table.createdAt),
    index('comments_parent_idx').on(table.parentId),
  ],
);

export const postSections = pgTable(
  'post_sections',
  {
    id: serial('id').primaryKey(),
    postId: integer('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    anchor: text('anchor').notNull(),
    heading: text('heading').notNull(),
    content: text('content').notNull(),
    contentHash: text('content_hash').notNull(),
    embedding: vector('embedding', { dimensions: 384 }),
  },
  (table) => [
    uniqueIndex('post_sections_post_position_idx').on(table.postId, table.position),
    index('post_sections_text_idx').using(
      'gin',
      sql`to_tsvector('english', ${table.heading} || ' ' || ${table.content})`,
    ),
    index('post_sections_embedding_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
  ],
);

export const searchEvents = pgTable(
  'search_events',
  {
    id: serial('id').primaryKey(),
    clientId: text('client_id').unique(),
    query: text('query').notNull(),
    resultCount: integer('result_count').notNull(),
    topic: text('topic'),
    openedUrl: text('opened_url'),
    progress: integer('progress').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('search_events_created_idx').on(table.createdAt),
    index('search_events_query_idx').on(table.query),
  ],
);

export const dismissedSearches = pgTable('dismissed_searches', {
  query: text('query').primaryKey(),
  dismissedAt: timestamp('dismissed_at').notNull().defaultNow(),
  dismissedBy: integer('dismissed_by').references(() => users.id, { onDelete: 'set null' }),
});

export const askStatus = pgEnum('ask_status', ['answered', 'not_found', 'error']);

export const assistantSettings = pgTable('assistant_settings', {
  id: integer('id').primaryKey().default(1),
  enabled: boolean('enabled').notNull().default(false),
  adminEnabled: boolean('admin_enabled').notNull().default(false),
  provider: text('provider').notNull().default('groq'),
  model: text('model').notNull().default('openai/gpt-oss-120b'),
  baseUrl: text('base_url').notNull().default(''),
  dailyLimit: integer('daily_limit').notNull().default(800),
  perReaderLimit: integer('per_reader_limit').notNull().default(20),
  answerLength: text('answer_length').notNull().default('medium'),
  creativity: integer('creativity').notNull().default(2),
  updatedBy: integer('updated_by').references(() => users.id, { onDelete: 'set null' }),
  updatedAt: timestamp('updated_at')
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const askEvents = pgTable(
  'ask_events',
  {
    id: text('id').primaryKey(),
    question: text('question').notNull(),
    visitor: text('visitor').notNull(),
    status: askStatus('status').notNull(),
    audience: text('audience').notNull().default('reader'),
    sourceCount: integer('source_count').notNull().default(0),
    helpful: boolean('helpful'),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('ask_events_created_idx').on(table.createdAt),
    index('ask_events_visitor_idx').on(table.visitor, table.createdAt),
  ],
);

export const pageVisits = pgTable(
  'page_visits',
  {
    id: text('id').primaryKey(),
    path: text('path').notNull(),
    postId: integer('post_id').references(() => posts.id, { onDelete: 'set null' }),
    visitor: text('visitor').notNull(),
    landing: boolean('landing').notNull().default(false),
    returning: boolean('returning').notNull().default(false),
    source: text('source').notNull().default('internal'),
    referrerHost: text('referrer_host'),
    device: text('device').notNull().default('desktop'),
    signedIn: boolean('signed_in').notNull().default(false),
    readDepth: integer('read_depth').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('page_visits_created_idx').on(table.createdAt),
    index('page_visits_post_idx').on(table.postId, table.createdAt),
  ],
);