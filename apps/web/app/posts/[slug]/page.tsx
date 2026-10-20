import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isSafeLink } from '@aviandev/core/text';
import Comments from '@/components/comments/comments';
import PostView from '@/components/post-view';
import ViewCounter from '@/components/view-counter';
import { getComments } from '@/lib/comments';
import { getContentByCMS } from '@/lib/content';
import { getPost, getPosts } from '@/lib/posts';
import { absoluteUrl } from '@/lib/site';
import { commentText, postText, siteText } from '../../text';

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const posts = await getPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [post, site] = await Promise.all([getPost(slug), getContentByCMS('web-site', siteText)]);
  if (!post) return {};

  const url = `/posts/${post.slug}`;
  const title = post.seoTitle || post.title;
  const description = post.seoDescription || post.excerpt || undefined;

  return {
    title,
    description,
    alternates: { canonical: url },
    robots: post.noindex ? { index: false, follow: true } : undefined,
    openGraph: {
      type: 'article',
      url,
      siteName: site.siteName,
      title,
      description,
      publishedTime: post.publishedAt ?? undefined,
      modifiedTime: post.updatedAt,
      authors: post.authorName ? [post.authorName] : undefined,
      tags: post.categories.map((category) => category.name),
    },
  };
}

export default async function PostPage({ params }: Props) {
  const { slug } = await params;
  const [post, text, comments, commentLabels] = await Promise.all([
    getPost(slug),
    getContentByCMS('web-post', postText),
    getComments(slug),
    getContentByCMS('web-comments', commentText),
  ]);
  if (!post) notFound();

  const postUrl = absoluteUrl(`/posts/${post.slug}`);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt || undefined,
    url: postUrl,
    mainEntityOfPage: postUrl,
    image: isSafeLink(post.shareImage)
      ? post.shareImage.startsWith('/')
        ? absoluteUrl(post.shareImage)
        : post.shareImage
      : `${postUrl}/opengraph-image`,
    datePublished: post.publishedAt ?? undefined,
    dateModified: post.updatedAt,
    author: post.authorName ? { '@type': 'Person', name: post.authorName } : undefined,
    keywords: post.categories.map((category) => category.name).join(', ') || undefined,
    commentCount: comments.count,
  };

  return (
    <>
      <PostView
        post={post}
        text={text}
        meta={<ViewCounter slug={post.slug} one={text.viewsOne} many={text.viewsMany} />}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
        />
      </PostView>
      <Comments slug={post.slug} initial={comments} text={commentLabels} />
    </>
  );
}