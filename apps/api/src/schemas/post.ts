import { z } from 'zod';

export const slugField = z
  .string({ error: 'Slug is required' })
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase letters, numbers and hyphens');

const isSafeImage = (value: string) =>
  value === '' || /^https?:\/\//i.test(value) || (value.startsWith('/') && !value.startsWith('//'));

const postFields = {
  title: z.string({ error: 'Title is required' }).trim().min(1, 'Title is required').max(200),
  slug: slugField,
  excerpt: z.string().trim().max(300, 'Excerpt must be 300 characters or fewer'),
  seoTitle: z.string().trim().max(70, 'SEO title must be 70 characters or fewer'),
  seoDescription: z.string().trim().max(200, 'Meta description must be 200 characters or fewer'),
  shareImage: z.string().trim().max(2000).refine(isSafeImage, 'Share image must start with https:// or /'),
  noindex: z.boolean(),
  content: z.looseObject({ type: z.literal('doc') }),
  published: z.boolean(),
  categoryIds: z
    .array(z.number().int().positive())
    .max(10, 'A post can have at most 10 categories')
    .transform((ids) => [...new Set(ids)]),
};

export const createPostSchema = z.object({
  ...postFields,
  excerpt: postFields.excerpt.default(''),
  seoTitle: postFields.seoTitle.default(''),
  seoDescription: postFields.seoDescription.default(''),
  shareImage: postFields.shareImage.default(''),
  noindex: postFields.noindex.default(false),
  content: postFields.content.optional(),
  published: postFields.published.default(false),
  categoryIds: postFields.categoryIds.default([]),
});

export const updatePostSchema = z
  .object(postFields)
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update',
  });