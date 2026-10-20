import Link from 'next/link';
import { Plus } from 'lucide-react';
import { apiGet, getCurrentUser } from '@/lib/api';
import { getContentByCMS } from '@/lib/content';
import { fill, formatDate } from '@/lib/text';
import { formatCount } from '@aviandev/core/text';
import { postsText } from './text';

export const instant = false;

type PostRow = {
  id: number;
  title: string;
  slug: string;
  published: boolean;
  publishedAt: string | null;
  updatedAt: string;
  authorName: string | null;
  views: number;
  categories: { id: number; name: string; slug: string }[];
};

type Filter = 'all' | 'draft' | 'published';

export default async function PostsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const filter: Filter = status === 'draft' || status === 'published' ? status : 'all';

  const [user, posts, text] = await Promise.all([
    getCurrentUser(),
    apiGet<PostRow[]>('/admin/posts').then((list) => list ?? []),
    getContentByCMS('admin-posts', postsText),
  ]);

  const drafts = posts.filter((post) => !post.published);
  const published = posts.filter((post) => post.published);
  const visible = filter === 'draft' ? drafts : filter === 'published' ? published : posts;
  const showAuthor = user?.role === 'super_admin';

  const tabs: { key: Filter; label: string; href: string }[] = [
    { key: 'all', label: fill(text.filterAll, { count: posts.length }), href: '/posts' },
    { key: 'draft', label: fill(text.filterDrafts, { count: drafts.length }), href: '/posts?status=draft' },
    { key: 'published', label: fill(text.filterPublished, { count: published.length }), href: '/posts?status=published' },
  ];

  const emptyMessage = filter === 'draft' ? text.emptyDrafts : filter === 'published' ? text.emptyPublished : text.empty;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">{text.title}</h1>
          <p className="mt-1 text-zinc-500">{text.subtitle}</p>
        </div>
        <Link
          href="/posts/new"
          className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          <Plus size={16} aria-hidden />
          {text.newPost}
        </Link>
      </div>

      <nav aria-label={text.filterLabel} className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={filter === tab.key ? 'page' : undefined}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              filter === tab.key ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-100'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {visible.length === 0 ? (
        <p className="rounded-xl bg-white p-6 text-sm text-zinc-500 ring-1 ring-zinc-200">{emptyMessage}</p>
      ) : (
        <ul className="divide-y divide-zinc-200 overflow-hidden rounded-xl bg-white ring-1 ring-zinc-200">
          {visible.map((post) => {
            const title = post.title || text.untitled;
            return (
              <li key={post.id} className="flex flex-wrap items-start justify-between gap-4 p-4">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-zinc-900">{title}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        post.published ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {post.published ? text.statusPublished : text.statusDraft}
                    </span>
                  </div>

                  {post.categories.length > 0 && (
                    <ul className="flex flex-wrap gap-1.5">
                      {post.categories.map((category) => (
                        <li key={category.id} className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">
                          {category.name}
                        </li>
                      ))}
                    </ul>
                  )}

                  <p className="text-sm text-zinc-500">
                    {post.published && post.publishedAt
                      ? fill(text.publishedOn, { date: formatDate(post.publishedAt) })
                      : fill(text.editedOn, { date: formatDate(post.updatedAt) })}
                    {post.published && <> · {formatCount(post.views, text.viewsOne, text.viewsMany)}</>}
                    {showAuthor && <> · {post.authorName ? fill(text.byAuthor, { name: post.authorName }) : text.unknownAuthor}</>}
                  </p>
                </div>

                <Link
                  href={`/posts/${post.id}`}
                  aria-label={fill(text.editLabel, { title })}
                  className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium ring-1 ring-zinc-300 hover:bg-zinc-100"
                >
                  {text.edit}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}