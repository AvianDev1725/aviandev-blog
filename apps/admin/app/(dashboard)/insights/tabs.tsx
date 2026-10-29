'use client';

import { fill } from '@/lib/text';
import { ChartCard, DataTable, IdeaList, KpiGrid, type Kpi } from '@/components/insights/cards';
import {
  ColumnChart,
  Funnel,
  Legend,
  LineChart,
  RankBars,
  ShareBar,
  formatDay,
  formatNumber,
  percent,
  total,
} from '@/components/insights/charts';
import type { InsightsText } from './text';
import type { Ask, Content, Overview, People, Search, Traffic } from './types';

const C1 = 'var(--chart-1)';
const C2 = 'var(--chart-2)';
const C3 = 'var(--chart-3)';
const C1_SOFT = 'rgb(13 148 136 / 0.1)';
const C3_SOFT = 'rgb(98 80 214 / 0.07)';

type Props<T> = { data: T; text: InsightsText; days: number; blogUrl: string };

const cardText = (text: InsightsText) => ({ showAs: text.showAs, chartView: text.chartView, listView: text.listView });
const kpiProps = (text: InsightsText, days: number) => ({
  compareNote: fill(text.compareNote, { days }),
  vsPrevious: fill(text.vsPrevious, { days }),
  newLabel: text.newMetric,
});

function dayRows(dates: string[], series: number[][]) {
  return dates.map((date, index) => [formatDay(date), ...series.map((values) => formatNumber(values[index] ?? 0))]).reverse();
}

function sourceInfo(text: InsightsText, source: string) {
  if (source === 'organic') return { label: text.sourceOrganic, sub: text.sourceOrganicHint };
  if (source === 'direct') return { label: text.sourceDirect, sub: text.sourceDirectHint };
  if (source === 'social') return { label: text.sourceSocial, sub: text.sourceSocialHint };
  return { label: text.sourceReferral, sub: text.sourceReferralHint };
}

function SourcesCard({ id, text, sources, hint }: { id: string; text: InsightsText; sources: { source: string; visits: number }[]; hint?: string }) {
  const sum = total(sources.map((row) => row.visits));
  const rows = sources.map((row) => ({ ...row, ...sourceInfo(text, row.source) }));
  return (
    <ChartCard
      id={id}
      title={text.sourcesTitle}
      hint={hint}
      text={cardText(text)}
      chart={
        <RankBars
          empty={text.empty}
          items={rows.map((row) => ({ key: row.source, label: row.label, sub: row.sub, value: row.visits, display: `${formatNumber(row.visits)} · ${percent(row.visits, sum)}%` }))}
        />
      }
      list={
        <DataTable
          empty={text.empty}
          columns={[{ label: text.source }, { label: text.visits, numeric: true }, { label: text.share, numeric: true }]}
          rows={rows.map((row) => [
            <>
              {row.label}
              <span className="block text-xs text-zinc-500">{row.sub}</span>
            </>,
            formatNumber(row.visits),
            `${percent(row.visits, sum)}%`,
          ])}
        />
      }
    />
  );
}

function PostLink({ slug, title, blogUrl }: { slug: string; title: string; blogUrl: string }) {
  return (
    <a href={`${blogUrl}/posts/${slug}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
      {title}
    </a>
  );
}

/* ---------------- Overview ---------------- */

export function OverviewTab({ data, text, days, blogUrl }: Props<Overview>) {
  const k = data.kpis;
  const kpis: Kpi[] = [
    { key: 'visitors', label: text.visitors, icon: '🧑', values: k.visitors.values, previous: k.visitors.previous },
    { key: 'views', label: text.pageViews, icon: '👀', values: k.views.values, previous: k.views.previous },
    { key: 'returning', label: text.returningVisitors, icon: '🔁', values: k.returning.values, previous: k.returning.previous },
    { key: 'signups', label: text.signups, icon: '✍️', values: k.signups.values, previous: k.signups.previous },
    { key: 'comments', label: text.comments, icon: '💬', values: k.comments.values, previous: k.comments.previous },
    { key: 'questions', label: text.questions, icon: '🤖', values: k.questions.values, previous: k.questions.previous },
  ];

  return (
    <>
      <KpiGrid items={kpis} {...kpiProps(text, days)} />
      <ChartCard
        id="ov-visitors"
        wide
        title={text.visitorsTitle}
        hint={`${text.visitorsHint}. ${text.uniqueHint}`}
        text={cardText(text)}
        chart={
          <>
            <Legend items={[{ label: text.pageViews, color: C3, line: true }, { label: text.visitors, color: C1, line: true }]} />
            <LineChart
              dates={data.dates}
              lines={[
                { label: text.pageViews, color: C3, values: k.views.values, fill: C3_SOFT },
                { label: text.visitors, color: C1, values: k.visitors.values, fill: C1_SOFT },
              ]}
            />
          </>
        }
        list={
          <DataTable
            empty={text.empty}
            columns={[{ label: text.day }, { label: text.visitors, numeric: true }, { label: text.pageViews, numeric: true }]}
            rows={dayRows(data.dates, [k.visitors.values, k.views.values])}
          />
        }
      />
      <ChartCard
        id="ov-posts"
        title={text.topPostsTitle}
        hint={text.topPostsHint}
        text={cardText(text)}
        chart={<RankBars empty={text.empty} items={data.topPosts.map((post) => ({ key: String(post.postId), label: post.title, value: post.views }))} />}
        list={
          <DataTable
            empty={text.empty}
            columns={[{ label: text.post }, { label: text.views, numeric: true }, { label: text.read, numeric: true }]}
            rows={data.topPosts.map((post) => [<PostLink key="p" {...post} blogUrl={blogUrl} />, formatNumber(post.views), `${post.readThrough}%`])}
          />
        }
      />
      <SourcesCard id="ov-sources" text={text} sources={data.sources} hint={text.sourcesHint} />
    </>
  );
}

/* ---------------- Traffic ---------------- */

export function TrafficTab({ data, text, days }: Props<Traffic>) {
  const visits = data.signedIn.readers + data.signedIn.guests;
  const deviceLabel = (device: string) => (device === 'phone' ? text.devicePhone : device === 'tablet' ? text.deviceTablet : text.deviceDesktop);
  const deviceColor = (device: string) => (device === 'phone' ? C1 : device === 'tablet' ? C2 : C3);
  const pageLabel = (path: string) =>
    path === '/' ? text.pageHome : path === '/search' ? text.pageSearch : path.startsWith('/categories') ? `${text.pageTopics}${path.slice(11) ? ` › ${path.slice(12)}` : ''}` : path;

  return (
    <>
      <KpiGrid
        {...kpiProps(text, days)}
        items={[
          { key: 'visitors', label: text.visitors, icon: '🧑', values: data.visitors.values, previous: data.visitors.previous },
          { key: 'views', label: text.pageViews, icon: '👀', values: data.views.values, previous: data.views.previous },
          { key: 'organic', label: text.organicVisitors, icon: '🔎', values: data.organic.values, previous: data.organic.previous },
        ]}
      />
      <ChartCard
        id="tr-new"
        wide
        title={text.newReturningTitle}
        hint={text.newReturningHint}
        text={cardText(text)}
        chart={
          <>
            <Legend items={[{ label: text.newLabel, color: C1 }, { label: text.returningLabel, color: C3 }]} />
            <ColumnChart
              dates={data.dates}
              stacks={[
                { label: text.newLabel, color: C1, values: data.newVisitors.values },
                { label: text.returningLabel, color: C3, values: data.returning.values },
              ]}
            />
          </>
        }
        list={
          <DataTable
            empty={text.empty}
            columns={[{ label: text.day }, { label: text.newLabel, numeric: true }, { label: text.returningLabel, numeric: true }]}
            rows={dayRows(data.dates, [data.newVisitors.values, data.returning.values])}
          />
        }
      />
      <SourcesCard id="tr-sources" text={text} sources={data.sources} hint={text.sourcesHint} />
      <ChartCard
        id="tr-engines"
        title={text.enginesTitle}
        hint={text.enginesHint}
        text={cardText(text)}
        chart={<RankBars empty={text.empty} items={data.engines.map((row) => ({ key: row.name, label: row.name, value: row.visits }))} />}
        list={
          <DataTable
            empty={text.empty}
            columns={[{ label: text.engine }, { label: text.visits, numeric: true }]}
            rows={data.engines.map((row) => [row.name, formatNumber(row.visits)])}
          />
        }
      />
      <ChartCard
        id="tr-referrers"
        title={text.referrersTitle}
        hint={text.referrersHint}
        text={cardText(text)}
        chart={<RankBars empty={text.empty} items={data.referrers.map((row) => ({ key: row.host, label: row.host, value: row.visits }))} />}
        list={
          <DataTable
            empty={text.empty}
            columns={[{ label: text.site }, { label: text.visits, numeric: true }]}
            rows={data.referrers.map((row) => [row.host, formatNumber(row.visits)])}
          />
        }
      />
      <ChartCard
        id="tr-devices"
        title={text.devicesTitle}
        text={cardText(text)}
        chart={
          <ShareBar
            empty={text.empty}
            items={data.devices.map((row) => ({ key: row.device, label: deviceLabel(row.device), value: row.visits, color: deviceColor(row.device) }))}
          />
        }
        list={
          <DataTable
            empty={text.empty}
            columns={[{ label: text.device }, { label: text.visits, numeric: true }, { label: text.share, numeric: true }]}
            rows={data.devices.map((row) => [deviceLabel(row.device), formatNumber(row.visits), `${percent(row.visits, total(data.devices.map((d) => d.visits)))}%`])}
          />
        }
      />
      <ChartCard
        id="tr-signedin"
        title={text.signedInTitle}
        hint={text.signedInHint}
        text={cardText(text)}
        chart={
          <ShareBar
            empty={text.empty}
            items={[
              { key: 'readers', label: text.signedInReaders, value: data.signedIn.readers, color: C1 },
              { key: 'guests', label: text.guests, value: data.signedIn.guests, color: '#d4d4d8' },
            ]}
          />
        }
        list={
          <DataTable
            empty={text.empty}
            columns={[{ label: text.visitor }, { label: text.visits, numeric: true }, { label: text.share, numeric: true }]}
            rows={
              visits
                ? [
                    [text.signedInReaders, formatNumber(data.signedIn.readers), `${percent(data.signedIn.readers, visits)}%`],
                    [text.guests, formatNumber(data.signedIn.guests), `${percent(data.signedIn.guests, visits)}%`],
                  ]
                : []
            }
          />
        }
      />
      <ChartCard
        id="tr-pages"
        title={text.pagesTitle}
        hint={text.pagesHint}
        text={cardText(text)}
        chart={<RankBars empty={text.empty} items={data.pages.map((row) => ({ key: row.path, label: pageLabel(row.path), value: row.views }))} />}
        list={
          <DataTable
            empty={text.empty}
            columns={[{ label: text.page }, { label: text.views, numeric: true }]}
            rows={data.pages.map((row) => [pageLabel(row.path), formatNumber(row.views)])}
          />
        }
      />
      <p className="flex gap-2.5 rounded-2xl bg-teal-50 px-3.5 py-3 text-[13px] text-zinc-700 ring-1 ring-teal-100 md:col-span-2">
        <span aria-hidden>🔒</span>
        {text.privacyNote}
      </p>
    </>
  );
}

/* ---------------- Content ---------------- */

export function ContentTab({ data, text, blogUrl }: Props<Content>) {
  const read = [...data.posts].filter((post) => post.readThrough > 0).sort((a, b) => b.readThrough - a.readThrough);
  return (
    <>
      <KpiGrid
        vsPrevious=""
        newLabel={text.newMetric}
        items={[
          { key: 'posts', label: text.posts, icon: '🗂', value: data.counts.total },
          { key: 'published', label: text.published, icon: '🌐', value: data.counts.published },
          { key: 'drafts', label: text.drafts, icon: '✏️', value: data.counts.drafts },
        ]}
      />
      <ChartCard
        id="ct-posts"
        wide
        title={text.contentPostsTitle}
        hint={text.contentPostsHint}
        text={cardText(text)}
        chart={<RankBars empty={text.empty} items={data.posts.map((post) => ({ key: String(post.postId), label: post.title, value: post.views }))} />}
        list={
          <DataTable
            empty={text.empty}
            columns={[
              { label: text.post },
              { label: text.views, numeric: true },
              { label: text.unique, numeric: true },
              { label: text.read, numeric: true },
              { label: text.comments, numeric: true },
            ]}
            rows={data.posts.map((post) => [
              <>
                <PostLink {...post} blogUrl={blogUrl} />
                {post.topics.length > 0 && <span className="block text-xs text-zinc-500">{post.topics.join(', ')}</span>}
              </>,
              formatNumber(post.views),
              formatNumber(post.visitors),
              `${post.readThrough}%`,
              formatNumber(post.comments),
            ])}
          />
        }
      />
      <ChartCard
        id="ct-read"
        title={text.readThroughTitle}
        hint={text.readThroughHint}
        text={cardText(text)}
        chart={<RankBars empty={text.empty} color={C3} items={read.map((post) => ({ key: String(post.postId), label: post.title, value: post.readThrough, display: `${post.readThrough}%` }))} />}
        list={
          <DataTable
            empty={text.empty}
            columns={[{ label: text.post }, { label: text.read, numeric: true }]}
            rows={read.map((post) => [post.title, `${post.readThrough}%`])}
          />
        }
      />
      <ChartCard
        id="ct-commented"
        title={text.mostCommentedTitle}
        text={cardText(text)}
        chart={<RankBars empty={text.empty} color={C2} items={data.mostCommented.map((post) => ({ key: String(post.postId), label: post.title, value: post.comments }))} />}
        list={
          <DataTable
            empty={text.empty}
            columns={[{ label: text.post }, { label: text.comments, numeric: true }]}
            rows={data.mostCommented.map((post) => [post.title, formatNumber(post.comments)])}
          />
        }
      />
      <ChartCard
        id="ct-topics"
        title={text.topicsTitle}
        text={cardText(text)}
        chart={<RankBars empty={text.empty} items={data.topics.map((row) => ({ key: row.slug, label: row.name, value: row.posts }))} />}
        list={
          <DataTable
            empty={text.empty}
            columns={[{ label: text.topic }, { label: text.posts, numeric: true }]}
            rows={data.topics.map((row) => [row.name, formatNumber(row.posts)])}
          />
        }
      />
      <ChartCard
        id="ct-comments-day"
        title={text.commentsPerDayTitle}
        text={cardText(text)}
        chart={<ColumnChart dates={data.dates} height={150} stacks={[{ label: text.comments, color: C2, values: data.comments.values }]} />}
        list={
          <DataTable
            empty={text.empty}
            columns={[{ label: text.day }, { label: text.comments, numeric: true }]}
            rows={dayRows(data.dates, [data.comments.values])}
          />
        }
      />
    </>
  );
}

/* ---------------- People ---------------- */

export function PeopleTab({ data, text, days }: Props<People>) {
  const c = data.counts;
  return (
    <>
      <KpiGrid
        {...kpiProps(text, days)}
        items={[
          { key: 'readers', label: text.readers, icon: '📚', value: c.readers },
          { key: 'verified', label: text.verified, icon: '✅', value: c.verified },
          { key: 'signed-in', label: text.signedInVisitors, icon: '🔑', value: c.signedInVisitors, note: text.inThisPeriod },
          { key: 'admins', label: text.admins, icon: '🛠', value: c.admins },
          { key: 'super-admins', label: text.superAdmins, icon: '👑', value: c.superAdmins },
          { key: 'waiting', label: text.waiting, icon: '⏳', value: c.waiting },
          { key: 'banned', label: text.banned, icon: '🚫', value: c.banned },
        ]}
      />
      <ChartCard
        id="pp-signups"
        wide
        title={text.signupsTitle}
        text={cardText(text)}
        chart={<ColumnChart dates={data.dates} height={160} stacks={[{ label: text.signups, color: C1, values: data.signups.values }]} />}
        list={
          <DataTable
            empty={text.empty}
            columns={[{ label: text.day }, { label: text.signups, numeric: true }]}
            rows={dayRows(data.dates, [data.signups.values])}
          />
        }
      />
      <ChartCard
        id="pp-team"
        title={text.teamTitle}
        text={cardText(text)}
        chart={
          <RankBars
            empty={text.empty}
            items={[
              { key: 'super', label: text.superAdmins, value: c.superAdmins },
              { key: 'admins', label: text.admins, value: c.admins },
              { key: 'waiting', label: text.waiting, value: c.waiting },
            ]}
          />
        }
        list={
          <DataTable
            empty={text.empty}
            columns={[{ label: text.role }, { label: text.people, numeric: true }]}
            rows={[
              [text.superAdmins, formatNumber(c.superAdmins)],
              [text.admins, formatNumber(c.admins)],
              [text.waiting, formatNumber(c.waiting)],
            ]}
          />
        }
      />
      <ChartCard
        id="pp-readers"
        title={text.readersTitle}
        text={cardText(text)}
        chart={
          <RankBars
            empty={text.empty}
            items={[
              { key: 'verified', label: text.verified, value: c.verified },
              { key: 'not-verified', label: text.notVerified, value: c.notVerified },
              { key: 'banned', label: text.banned, value: c.banned },
            ]}
          />
        }
        list={
          <DataTable
            empty={text.empty}
            columns={[{ label: text.readersTitle }, { label: text.count, numeric: true }]}
            rows={[
              [text.verified, formatNumber(c.verified)],
              [text.notVerified, formatNumber(c.notVerified)],
              [text.banned, formatNumber(c.banned)],
            ]}
          />
        }
      />
    </>
  );
}

/* ---------------- Search ---------------- */

export function SearchTab({ data, text, days, blogUrl }: Props<Search>) {
  const t = data.totals;
  const dates = data.perDay.map((row) => row.day);
  const perDay = data.perDay.map((row) => row.searches);
  const steps = [
    { label: text.funnelSearched, value: t.searches },
    { label: text.funnelResultsPage, value: t.reachedResultsPage },
    { label: text.funnelOpened, value: t.opened },
  ];

  return (
    <>
      {days > 30 && <p className="text-[13px] text-zinc-500 md:col-span-2">{text.keptNote}</p>}
      <KpiGrid
        vsPrevious=""
        newLabel={text.newMetric}
        items={[
          { key: 'searches', label: text.searches, icon: '🔍', values: perDay },
          { key: 'found', label: text.foundResults, icon: '🎯', value: percent(t.withResults, t.searches), suffix: '%', note: text.percentOfSearches },
          { key: 'engagement', label: text.engagement, icon: '🧭', value: t.engagement, suffix: '%', note: text.percentAverage },
        ]}
      />
      <ChartCard
        id="sr-funnel"
        wide
        title={text.funnelTitle}
        hint={text.funnelHint}
        text={cardText(text)}
        chart={<Funnel steps={steps} />}
        list={
          <DataTable
            empty={text.empty}
            columns={[{ label: text.step }, { label: text.searches, numeric: true }, { label: text.share, numeric: true }]}
            rows={steps.map((step) => [step.label, formatNumber(step.value), `${percent(step.value, t.searches)}%`])}
          />
        }
      />
      <ChartCard
        id="sr-day"
        title={text.searchesPerDayTitle}
        text={cardText(text)}
        chart={<ColumnChart dates={dates} height={150} stacks={[{ label: text.searches, color: C1, values: perDay }]} />}
        list={<DataTable empty={text.empty} columns={[{ label: text.day }, { label: text.searches, numeric: true }]} rows={dayRows(dates, [perDay])} />}
      />
      <ChartCard
        id="sr-ideas"
        title={`💡 ${text.ideasTitle}`}
        hint={text.ideasHint}
        text={cardText(text)}
        chart={
          <IdeaList
            empty={text.ideasEmpty}
            startLabel={text.startPost}
            dismissLabel={text.dismiss}
            ideas={data.ideas.map((idea) => ({
              query: idea.query,
              meta: `${fill(text.timesSearched, { count: idea.searches })} · ${fill(text.lastDate, { date: formatDay(String(idea.lastSearched).slice(0, 10)) })}`,
            }))}
          />
        }
      />
      <ChartCard
        id="sr-top"
        title={text.topTitle}
        text={cardText(text)}
        chart={<RankBars empty={text.topEmpty} items={data.top.map((row) => ({ key: row.query, label: row.query, value: row.searches }))} />}
        list={
          <DataTable
            empty={text.topEmpty}
            columns={[{ label: text.search }, { label: text.times, numeric: true }, { label: text.engagement, numeric: true }]}
            rows={data.top.map((row) => [row.query, formatNumber(row.searches), `${row.engagement}%`])}
          />
        }
      />
      <ChartCard
        id="sr-unclicked"
        title={text.unclickedTitle}
        hint={text.unclickedHint}
        text={cardText(text)}
        chart={<RankBars empty={text.unclickedEmpty} color={C2} items={data.unclicked.map((row) => ({ key: row.query, label: row.query, value: row.searches }))} />}
        list={
          <DataTable
            empty={text.unclickedEmpty}
            columns={[{ label: text.search }, { label: text.times, numeric: true }, { label: text.averageResults, numeric: true }]}
            rows={data.unclicked.map((row) => [row.query, formatNumber(row.searches), formatNumber(row.averageResults)])}
          />
        }
      />
      <ChartCard
        id="sr-sections"
        title={text.sectionsTitle}
        text={cardText(text)}
        chart={
          <RankBars
            empty={text.sectionsEmpty}
            items={data.sections.map((row) => ({ key: row.url, label: row.postTitle, sub: row.heading || text.introduction, value: row.visits }))}
          />
        }
        list={
          <DataTable
            empty={text.sectionsEmpty}
            columns={[{ label: text.section }, { label: text.visits, numeric: true }]}
            rows={data.sections.map((row) => [
              <a key="s" href={`${blogUrl}${row.url}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                {row.postTitle} › {row.heading || text.introduction}
              </a>,
              formatNumber(row.visits),
            ])}
          />
        }
      />
    </>
  );
}

/* ---------------- Ask AvianDev ---------------- */

export function AskTab({ data, text, days, blogUrl }: Props<Ask>) {
  const t = data.totals;
  const votes = t.helpful + t.notHelpful;
  const dates = data.perDay.map((row) => row.day);
  const perDay = data.perDay.map((row) => row.questions);

  return (
    <>
      {days > 30 && <p className="text-[13px] text-zinc-500 md:col-span-2">{text.keptNote}</p>}
      <KpiGrid
        vsPrevious=""
        newLabel={text.newMetric}
        items={[
          { key: 'questions', label: text.questions, icon: '💬', values: perDay },
          { key: 'answered', label: text.answered, icon: '✅', value: percent(t.answered, t.questions), suffix: '%', note: text.answeredNote },
          { key: 'helpful', label: text.helpful, icon: '👍', value: percent(t.helpful, votes), suffix: '%', note: votes ? text.helpfulNote : text.noVotes },
        ]}
      />
      {t.errors > 0 && (
        <p className="rounded-2xl bg-amber-50 px-3.5 py-3 text-[13px] text-amber-900 ring-1 ring-amber-200 md:col-span-2">
          {fill(text.errorsNote, { count: t.errors })}
        </p>
      )}
      <ChartCard
        id="ak-day"
        wide
        title={text.questionsPerDayTitle}
        text={cardText(text)}
        chart={<ColumnChart dates={dates} height={160} stacks={[{ label: text.questions, color: C1, values: perDay }]} />}
        list={<DataTable empty={text.empty} columns={[{ label: text.day }, { label: text.questions, numeric: true }]} rows={dayRows(dates, [perDay])} />}
      />
      <ChartCard
        id="ak-unanswered"
        title={`💡 ${text.unansweredTitle}`}
        hint={text.unansweredHint}
        text={cardText(text)}
        chart={
          <IdeaList
            empty={text.unansweredEmpty}
            startLabel={text.startPost}
            dismissLabel={text.dismiss}
            ideas={data.unanswered.map((row) => ({
              query: row.question,
              meta: `${fill(text.timesAsked, { count: row.times })} · ${fill(text.lastDate, { date: formatDay(String(row.lastAsked).slice(0, 10)) })}`,
            }))}
          />
        }
      />
      <ChartCard
        id="ak-cited"
        title={text.citedTitle}
        text={cardText(text)}
        chart={
          <RankBars
            empty={text.citedEmpty}
            items={data.sections.map((row) => ({ key: row.url, label: row.postTitle, sub: row.heading || text.introduction, value: row.times }))}
          />
        }
        list={
          <DataTable
            empty={text.citedEmpty}
            columns={[{ label: text.section }, { label: text.answers, numeric: true }]}
            rows={data.sections.map((row) => [
              <a key="s" href={`${blogUrl}${row.url}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                {row.postTitle} › {row.heading || text.introduction}
              </a>,
              formatNumber(row.times),
            ])}
          />
        }
      />
    </>
  );
}