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
} from 'drizzle-orm/pg-core';
import type { FieldDefinition } from '../content/field-types.js';

export const userRole = pgEnum('user_role', ['reader', 'admin', 'super_admin']);
export const userStatus = pgEnum('user_status', ['pending', 'active', 'rejected']);

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: userRole('role').notNull().default('reader'),
  status: userStatus('status').notNull().default('pending'),
  reviewedBy: integer('reviewed_by').references((): AnyPgColumn => users.id, { onDelete: 'set null' }),
  reviewedAt: timestamp('reviewed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  excerpt: text('excerpt').notNull().default(''),
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
  data: text('data').notNull(),
  uploadedBy: integer('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});