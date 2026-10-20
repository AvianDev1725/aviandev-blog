import Link from 'next/link';
import { fill, formatCount, formatDate } from '@aviandev/core/text';
import type { PostSummary } from '@/lib/posts';
import { getContentByCMS } from '@/lib/content';
import { postText } from '@/app/text';

type Props = {
  posts: PostSummary[];
  emptyMessage: string;
  headingLevel?: 'h2' | 'h3';
};

export default async function PostList({ posts, emptyMessage, headingLevel: Heading = 'h2' }: Props) {
  if (posts.length === 0) return <p className="mt-4 text-zinc-500">{emptyMessage}</p>;

  const text = await getContentByCMS('web-post', postText);

  return (
    <ul className="mt-4 divide-y divide-zinc-200">
      {posts.map((post) => {
        const details = [
          post.publishedAt && (
            <time key="date" dateTime={post.publishedAt}>
              {formatDate(post.publishedAt)}
            </time>
          ),
          post.readingMinutes > 0 && (
            <span key="reading">{fill(text.readingTime, { count: post.readingMinutes })}</span>
          ),
          post.views > 0 && <span key="views">{formatCount(post.views, text.viewsOne, text.viewsMany)}</span>,
        ].filter(Boolean);

        return (
          <li key={post.id}>
            <article className="relative -mx-4 space-y-2 px-4 py-5 transition-colors active:bg-zinc-50 sm:mx-0 sm:px-0 sm:py-6 sm:active:bg-transparent">
              {details.length > 0 && (
                <p className="flex flex-wrap gap-x-2 text-sm text-zinc-500">
                  {details.map((detail, index) => (
                    <span key={index} className="contents">
                      {index > 0 && <span aria-hidden>·</span>}
                      {detail}
                    </span>
                  ))}
                </p>
              )}
              <Heading className="text-lg font-semibold leading-snug tracking-tight text-balance sm:text-xl">
                <Link href={`/posts/${post.slug}`} className="after:absolute after:inset-0 hover:underline">
                  {post.title}
                </Link>
              </Heading>
              {post.excerpt && <p className="line-clamp-3 text-zinc-600 sm:line-clamp-none">{post.excerpt}</p>}
              {post.categories.length > 0 && (
                <ul className="relative z-10 flex flex-wrap gap-2 pt-1">
                  {post.categories.map((category) => (
                    <li key={category.id}>
                      <Link
                        href={`/category/${category.slug}`}
                        className="inline-flex min-h-8 items-center rounded-full bg-zinc-100 px-3 text-xs font-medium text-zinc-700 active:bg-zinc-200 sm:hover:bg-zinc-200"
                      >
                        {category.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          </li>
        );
      })}
    </ul>
  );
}