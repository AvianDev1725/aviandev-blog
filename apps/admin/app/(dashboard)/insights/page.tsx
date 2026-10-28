import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiGet, getCurrentUser } from '@/lib/api';
import { getContentByCMS } from '@/lib/content';
import { fill, formatDate } from '@/lib/text';
import DismissButton from './dismiss-button';
import { insightsText } from './text';

export const instant = false;

type Row = { query: string; searches: number; averageResults: number; openedPercent: number; engagement: number };

type Insights = {
  days: number;
  totals: { searches: number; withResults: number; reachedResultsPage: number; opened: number; engagement: number };
  perDay: { day: string; searches: number }[];
  ideas: { query: string; searches: number; lastSearched: string }[];
  top: Row[];
  unclicked: Row[];
  sections: { url: string; visits: number; postTitle: string; heading: string }[];
};

const percent = (part: number, whole: number) => (whole === 0 ? 0 : Math.round((100 * part) / whole));

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl bg-white p-4 ring-1 ring-zinc-200 sm:p-5">
      <div>
        <h2 className="font-semibold text-zinc-900">{title}</h2>
        {hint && <p className="mt-0.5 text-sm text-zinc-500">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

export default async function InsightsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const user = await getCurrentUser();
  if (user?.role !== 'super_admin') notFound();

  const { days: requested } = await searchParams;
  const days = requested === '30' ? 30 : 7;
  const [data, text] = await Promise.all([
    apiGet<Insights>(`/insights/search?days=${days}`),
    getContentByCMS('admin-insights', insightsText),
  ]);
  if (!data) notFound();

  const blogUrl = process.env.BLOG_URL ?? 'http://localhost:3002';
  const { totals } = data;
  const busiestDay = Math.max(1, ...data.perDay.map((day) => day.searches));

  const stats = [
    { value: totals.searches.toLocaleString('en-IN'), label: text.searches },
    { value: `${percent(totals.withResults, totals.searches)}%`, label: text.foundResults },
    { value: `${totals.engagement}%`, label: text.engagement },
  ];

  const funnel = [
    { label: text.funnelSearched, count: totals.searches },
    { label: text.funnelResultsPage, count: totals.reachedResultsPage },
    { label: text.funnelOpened, count: totals.opened },
  ];

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 sm:text-2xl">{text.title}</h1>
          <p className="mt-1 text-zinc-500">{text.subtitle}</p>
        </div>
        <nav aria-label={text.rangeLabel} className="flex gap-2">
          {[
            { value: 7, label: text.last7 },
            { value: 30, label: text.last30 },
          ].map((range) => (
            <Link
              key={range.value}
              href={range.value === 7 ? '/insights' : '/insights?days=30'}
              aria-current={days === range.value ? 'page' : undefined}
              className={`rounded-full px-3.5 py-2 text-sm font-medium md:py-1.5 ${
                days === range.value ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-100'
              }`}
            >
              {range.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl bg-white p-4 ring-1 ring-zinc-200">
            <p className="text-2xl font-semibold text-zinc-900 sm:text-3xl">{stat.value}</p>
            <p className="mt-1 text-xs text-zinc-500 sm:text-sm">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-white p-4 ring-1 ring-zinc-200">
        <div className="flex h-24 items-end gap-1" role="img" aria-label={fill(text.chartLabel, { count: totals.searches, days })}>
          {data.perDay.map((day) => (
            <div
              key={day.day}
              title={`${formatDate(day.day)}: ${day.searches}`}
              className={`flex-1 rounded-t ${day.searches > 0 ? 'bg-zinc-800' : 'bg-zinc-200'}`}
              style={{ height: `${Math.max(4, (day.searches / busiestDay) * 100)}%` }}
            />
          ))}
        </div>
      </div>

      <Section title={`🧭 ${text.funnelTitle}`} hint={text.engagementHint}>
        <ul className="space-y-3">
          {funnel.map((step) => {
            const share = percent(step.count, totals.searches);
            return (
              <li key={step.label}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-zinc-800">{step.label}</span>
                  <span className="text-zinc-500">
                    {step.count.toLocaleString('en-IN')} · {share}%
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-zinc-100" aria-hidden>
                  <div className="h-full rounded-full bg-zinc-800" style={{ width: `${share}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title={`💡 ${text.ideasTitle}`} hint={text.ideasHint}>
        {data.ideas.length === 0 ? (
          <p className="text-sm text-zinc-500">{text.ideasEmpty}</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {data.ideas.map((idea) => (
              <li key={idea.query} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-medium text-zinc-900">{idea.query}</p>
                  <p className="text-sm text-zinc-500">
                    {fill(text.timesSearched, { count: idea.searches })} · {fill(text.lastSearched, { date: formatDate(idea.lastSearched) })}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/posts/new?title=${encodeURIComponent(idea.query)}`}
                    className="inline-flex h-10 items-center rounded-lg bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-700 md:h-8"
                  >
                    {text.startPost}
                  </Link>
                  <DismissButton query={idea.query} label={text.dismiss} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title={`🔥 ${text.topTitle}`}>
          {data.top.length === 0 ? (
            <p className="text-sm text-zinc-500">{text.topEmpty}</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {data.top.map((row) => (
                <li key={row.query} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="min-w-0 truncate font-medium text-zinc-900">{row.query}</span>
                  <span className="shrink-0 text-zinc-500">
                    {fill(text.timesSearched, { count: row.searches })} · {fill(text.engagementCount, { count: row.engagement })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title={`🤔 ${text.unclickedTitle}`} hint={text.unclickedHint}>
          {data.unclicked.length === 0 ? (
            <p className="text-sm text-zinc-500">{text.unclickedEmpty}</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {data.unclicked.map((row) => (
                <li key={row.query} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="min-w-0 truncate font-medium text-zinc-900">{row.query}</span>
                  <span className="shrink-0 text-zinc-500">
                    {fill(text.timesSearched, { count: row.searches })} · {fill(text.resultsAverage, { count: row.averageResults })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Section title={`📍 ${text.sectionsTitle}`}>
        {data.sections.length === 0 ? (
          <p className="text-sm text-zinc-500">{text.sectionsEmpty}</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {data.sections.map((section) => (
              <li key={section.url} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <a
                  href={`${blogUrl}${section.url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 truncate font-medium text-zinc-900 hover:underline"
                >
                  {section.postTitle} › {section.heading || text.introduction}
                </a>
                <span className="shrink-0 text-zinc-500">{fill(text.visits, { count: section.visits })}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}