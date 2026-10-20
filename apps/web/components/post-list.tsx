import Link from 'next/link';
import { formatDate } from '@aviandev/core/text';
import type { PostSummary } from '@/lib/posts';

type Props = {
  posts: PostSummary[];
  emptyMessage: string;
  headingLevel?: 'h2' | 'h3';
};

export default function PostList({ posts, emptyMessage, headingLevel: Heading = 'h2' }: Props) {
  if (posts.length === 0) return <p className="mt-4 text-zinc-500">{emptyMessage}</p>;

  return (
    <ul className="mt-6 divide-y divide-zinc-200">
      {posts.map((post) => (
        <li key={post.id}>
          <article className="space-y-2 py-6">
            {post.publishedAt && (
              <time dateTime={post.publishedAt} className="text-sm text-zinc-500">
                {formatDate(post.publishedAt)}
              </time>
            )}
            <Heading className="text-xl font-semibold tracking-tight">
              <Link href={`/posts/${post.slug}`} className="hover:underline">
                {post.title}
              </Link>
            </Heading>
            {post.excerpt && <p className="text-zinc-600">{post.excerpt}</p>}
            {post.categories.length > 0 && (
              <ul className="flex flex-wrap gap-2 pt-1">
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
          </article>
        </li>
      ))}
    </ul>
  );
}