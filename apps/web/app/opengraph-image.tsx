import { ImageResponse } from 'next/og';
import { getContentByCMS } from '@/lib/content';
import { siteText } from './text';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  const site = await getContentByCMS('web-site', siteText);

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
        <div style={{ display: 'flex', fontSize: 80, fontWeight: 700 }}>{site.siteName}</div>
        <div style={{ display: 'flex', marginTop: 24, fontSize: 36, color: '#a1a1aa' }}>{site.tagline}</div>
      </div>
    ),
    size
  );
}