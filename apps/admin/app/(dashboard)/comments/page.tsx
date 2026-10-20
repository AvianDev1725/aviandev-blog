import Link from 'next/link';
import { BIRDS } from '@/components/bird-avatar';
import { apiGet, getCurrentUser } from '@/lib/api';
import { getManyByCMS } from '@/lib/content';
import { fill } from '@/lib/text';
import { commentText } from '../../../../web/app/text';
import CommentRow, { type ModerationComment } from './comment-row';
import { commentsText } from './text';

export const instant = false;

type Status = 'pending' | 'approved' | 'spam';
type ModerationList = { counts: Record<Status, number>; comments: ModerationComment[] };

export default async function CommentsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status: requested } = await searchParams;
  const status: Status = requested === 'approved' || requested === 'spam' ? requested : 'pending';

  const [user, data, content] = await Promise.all([
    getCurrentUser(),
    apiGet<ModerationList>(`/moderation/comments?status=${status}`),
    getManyByCMS({ 'admin-comments': commentsText, 'web-comments': commentText }),
  ]);
  const text = content['admin-comments'];
  const guestText = content['web-comments'] as Record<string, string>;
  const list = data ?? { counts: { pending: 0, approved: 0, spam: 0 }, comments: [] };

  const guestNames = Object.fromEntries(
    BIRDS.map((bird) => [bird, guestText[`guest${bird.charAt(0).toUpperCase()}${bird.slice(1)}`] ?? text.guest]),
  );

  const tabs: { key: Status; label: string; href: string }[] = [
    { key: 'pending', label: fill(text.tabPending, { count: list.counts.pending }), href: '/comments' },
    { key: 'approved', label: fill(text.tabApproved, { count: list.counts.approved }), href: '/comments?status=approved' },
    { key: 'spam', label: fill(text.tabSpam, { count: list.counts.spam }), href: '/comments?status=spam' },
  ];
  const emptyMessage = status === 'approved' ? text.emptyApproved : status === 'spam' ? text.emptySpam : text.emptyPending;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 sm:text-2xl">{text.title}</h1>
        <p className="mt-1 text-zinc-500">{text.subtitle}</p>
      </div>

      <nav aria-label={text.filterLabel} className="-mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={status === tab.key ? 'page' : undefined}
            className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-medium md:py-1.5 ${
              status === tab.key ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-100'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {list.comments.length === 0 ? (
        <p className="rounded-xl bg-white p-6 text-sm text-zinc-500 ring-1 ring-zinc-200">{emptyMessage}</p>
      ) : (
        <ul className="space-y-3">
          {list.comments.map((comment) => (
            <li key={comment.id}>
              <CommentRow
                comment={comment}
                text={text}
                guestNames={guestNames}
                canBan={user?.role === 'super_admin'}
                blogUrl={process.env.BLOG_URL ?? 'http://localhost:3002'}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}