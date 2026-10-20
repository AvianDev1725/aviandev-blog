import type { MetadataRoute } from 'next';
import { getCategories, getPosts } from '@/lib/posts';
import { absoluteUrl } from '@/lib/site';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, categories] = await Promise.all([getPosts(), getCategories().catch(() => [])]);

  const lastChanged = posts.reduce<string | undefined>(
    (latest, post) => (!latest || post.updatedAt > latest ? post.updatedAt : latest),
    undefined
  );

  return [
    { url: absoluteUrl('/'), lastModified: lastChanged },
    { url: absoluteUrl('/categories') },
    ...categories.map((category) => ({ url: absoluteUrl(`/category/${category.slug}`) })),
    ...posts
      .filter((post) => !post.noindex)
      .map((post) => ({ url: absoluteUrl(`/posts/${post.slug}`), lastModified: post.updatedAt })),
  ];
}