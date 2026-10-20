import { getCurrentUser } from '@/lib/api';
import { getContentByCMS } from '@/lib/content';
import { fill } from '@/lib/text';
import { dashboardText } from './text';
import { apiGet } from '@/lib/api';
import CommentsCard from './comments-card';

export const instant = false;

export default async function DashboardHome() {
  const [user, text] = await Promise.all([getCurrentUser(), getContentByCMS('admin-dashboard', dashboardText)]);
  const summary = await apiGet<{ pending: number }>('/moderation/summary');

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900">{fill(text.welcome, { name: user?.name ?? '' })}</h1>
      <p className="mt-1 text-zinc-500">{text.subtitle}</p>
      <CommentsCard
        pending={summary?.pending ?? 0}
        labels={{
          title: text.commentsTitle,
          waiting: text.commentsWaiting,
          none: text.commentsNone,
          review: text.commentsReview,
        }}
      />
    </div>
  );
}