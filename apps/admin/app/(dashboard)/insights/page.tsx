import { notFound } from 'next/navigation';
import { apiGet, getCurrentUser } from '@/lib/api';
import { getManyByCMS } from '@/lib/content';
import InsightsView from './insights-view';
import { insightsCms } from './text';
import { RANGES, TAB_IDS, type TabData, type TabId } from './types';

export const instant = false;

export default async function InsightsPage({ searchParams }: { searchParams: Promise<{ tab?: string; days?: string }> }) {
  const user = await getCurrentUser();
  if (user?.role !== 'super_admin') notFound();

  const params = await searchParams;
  const tab: TabId = TAB_IDS.includes(params.tab as TabId) ? (params.tab as TabId) : 'overview';
  const days = RANGES.find((range) => String(range) === params.days) ?? 7;

  const [data, cms] = await Promise.all([apiGet<TabData[TabId]>(`/insights/${tab}?days=${days}`), getManyByCMS(insightsCms)]);

  const text = {
    ...cms['admin-analytics'],
    ...cms['admin-analytics-traffic'],
    ...cms['admin-analytics-content'],
    ...cms['admin-analytics-search'],
    ...cms['admin-analytics-ask'],
  };

  return (
    <InsightsView
      text={text}
      initialTab={tab}
      initialDays={days}
      initialData={data}
      blogUrl={process.env.BLOG_URL ?? 'http://localhost:3002'}
    />
  );
}