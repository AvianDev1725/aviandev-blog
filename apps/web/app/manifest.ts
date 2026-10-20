import type { MetadataRoute } from 'next';
import { getContentByCMS } from '@/lib/content';
import { seoText, siteText } from './text';

const isOwnUpload = (src: string) => /^\/media\/[A-Za-z0-9._-]+$/.test(src);

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const [seo, site] = await Promise.all([getContentByCMS('web-seo', seoText), getContentByCMS('web-site', siteText)]);

  return {
    id: '/',
    name: seo.defaultTitle,
    short_name: site.siteName,
    description: seo.description,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    icons: isOwnUpload(seo.appIcon)
      ? [{ src: seo.appIcon, sizes: '512x512', type: 'image/png', purpose: 'any' }]
      : [],
  };
}