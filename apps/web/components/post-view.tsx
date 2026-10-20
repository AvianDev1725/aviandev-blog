import Link from 'next/link';
import type { ReactNode } from 'react';
import { fill, formatDate } from '@aviandev/core/text';
import PostContent from '@/components/post-content';
import type { Post } from '@/lib/posts';
import type { postText } from '@/app/text';

const ONE_DAY = 24 * 60 * 60 * 1000;

type Props = { post: Post; text: typeof postText; meta?: ReactNode; children?: ReactNode };

export default function PostView({ post, text, meta, children }: Props) {
  const wasUpdated =
    post.publishedAt !== null && new Date(post.updatedAt).getTime() - new Date(post.publishedAt).getTime() > ONE_DAY;

  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      {children}

      <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900">
        ← {text.allPosts}
      </Link>

      <header className="mt-6 space-y-4">
        {post.categories.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {post.categories.map((category) => (
              <li key={category.id}>
                <Link
                  href={`/category/${category.slug}`}
                  className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-200"
                >
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        )}

        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{post.title}</h1>
        {post.excerpt && <p className="text-lg text-zinc-600">{post.excerpt}</p>}

        <p className="flex flex-wrap gap-x-2 text-sm text-zinc-500">
          {post.authorName && <span>{fill(text.byAuthor, { name: post.authorName })}</span>}
          {post.publishedAt && (
            <span>
              {text.published} <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
            </span>
          )}
          {wasUpdated && (
            <span>
              {text.updated} <time dateTime={post.updatedAt}>{formatDate(post.updatedAt)}</time>
            </span>
          )}
          <span>{fill(text.readingTime, { count: post.readingMinutes })}</span>
          {meta}
        </p>
      </header>

      <div className="rich-text post-body mt-10">
        <PostContent doc={post.content} />
      </div>
    </article>
  );
}