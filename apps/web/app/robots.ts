import type { MetadataRoute } from 'next';
import { getContentByCMS } from '@/lib/content';
import { absoluteUrl } from '@/lib/site';
import { seoText } from './text';

export default async function robots(): Promise<MetadataRoute.Robots> {
  const seo = await getContentByCMS('web-seo', seoText);

  if (!seo.allowIndexing) {
    return { rules: { userAgent: '*', disallow: '/' } };
  }

  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/internal/', '/preview/'] },
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}