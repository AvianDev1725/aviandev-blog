import { ImageResponse } from 'next/og';
import { getContentByCMS } from '@/lib/content';
import { getPost, getPosts } from '@/lib/posts';
import { siteText } from '../../text';
import { isSafeLink } from '@aviandev/core/text';
import { absoluteUrl } from '@/lib/site';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export async function generateStaticParams() {
  const posts = await getPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [post, site] = await Promise.all([getPost(slug), getContentByCMS('web-site', siteText)]);
  if (post && isSafeLink(post.shareImage)) {
    const src = post.shareImage.startsWith('/') ? absoluteUrl(post.shareImage) : post.shareImage;
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
          justifyContent: 'space-between',
          width: '100%',
          height: '100%',
          padding: 72,
          background: '#18181b',
          color: '#fafafa',
        }}
      >
        <div style={{ display: 'flex', fontSize: 32, color: '#a1a1aa' }}>{site.siteName}</div>
        <div style={{ display: 'flex', fontSize: 68, fontWeight: 700, lineHeight: 1.15 }}>
          {post?.title ?? site.siteName}
        </div>
        <div style={{ display: 'flex', fontSize: 28, color: '#a1a1aa' }}>
          {post?.categories.map((category) => category.name).join(' · ') ?? ''}
        </div>
      </div>
    ),
    size
  );
}