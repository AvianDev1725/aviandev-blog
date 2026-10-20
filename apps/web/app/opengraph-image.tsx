import { ImageResponse } from 'next/og';
import { isSafeLink } from '@aviandev/core/text';
import { getContentByCMS } from '@/lib/content';
import { absoluteUrl } from '@/lib/site';
import { seoText, siteText } from './text';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  const [site, seo] = await Promise.all([getContentByCMS('web-site', siteText), getContentByCMS('web-seo', seoText)]);

  if (isSafeLink(seo.shareImage)) {
    const src = seo.shareImage.startsWith('/') ? absoluteUrl(seo.shareImage) : seo.shareImage;
    return new ImageResponse(
      (
        <div style={{ display: 'flex', width: '100%', height: '100%' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" width={1200} height={630} style={{ objectFit: 'cover' }} />
        </div>
      ),
      size
    );
  }

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          padding: 72,
          background: '#18181b',
          color: '#fafafa',
        }}
      >
        <div style={{ display: 'flex', fontSize: 80, fontWeight: 700 }}>{seo.defaultTitle}</div>
        <div style={{ display: 'flex', marginTop: 24, fontSize: 36, color: '#a1a1aa' }}>{site.tagline}</div>
      </div>
    ),
    size
  );
}