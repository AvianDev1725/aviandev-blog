import Link from 'next/link';
import { fill } from '@aviandev/core/text';
import type { PostSummary } from '@/lib/posts';
import type { postText } from '@/app/text';

type Props = { posts: PostSummary[]; text: typeof postText };

export default function RelatedPosts({ posts, text }: Props) {
  if (posts.length === 0) return null;

  return (
    <section aria-labelledby="related-heading" className="mx-auto max-w-3xl border-t border-zinc-200 px-4 py-10">
      <h2 id="related-heading" className="text-xl font-semibold tracking-tight">
        {text.relatedTitle}
      </h2>

      <ul className="-mx-4 mt-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0">
        {posts.map((post) => (
          <li key={post.id} className="w-[78%] shrink-0 snap-start sm:w-auto">
            <Link
              href={`/posts/${post.slug}`}
              className="flex h-full flex-col gap-2 rounded-xl bg-zinc-50 p-4 ring-1 ring-zinc-200 transition-colors active:bg-zinc-100 sm:hover:bg-zinc-100"
            >
              {post.categories[0] && (
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">{post.categories[0].name}</span>
              )}
              <span className="font-semibold leading-snug text-zinc-900 text-balance">{post.title}</span>
              {post.excerpt && <span className="line-clamp-2 text-sm text-zinc-600">{post.excerpt}</span>}
              {post.readingMinutes > 0 && (
                <span className="mt-auto pt-1 text-xs text-zinc-500">
                  {fill(text.readingTime, { count: post.readingMinutes })}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}