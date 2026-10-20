import type { Metadata } from 'next';
import Link from 'next/link';
import { formatDate } from '@aviandev/core/text';
import { getManyByCMS } from '@/lib/content';
import { getPosts } from '@/lib/posts';
import Banner from '@/components/banner';
import PostList from '@/components/post-list';
import { homeBanner, homeText, siteText } from './text';

export const metadata: Metadata = { alternates: { canonical: '/' } };

export default async function HomePage() {
  const [text, posts] = await Promise.all([
    getManyByCMS({ 'web-site': siteText, 'web-home': homeText, 'home-banner': homeBanner }),
    getPosts(),
  ]);
  const site = text['web-site'];
  const home = text['web-home'];
  const banner = text['home-banner'];
  const latest = posts.slice(0, Math.max(1, Math.floor(banner.postsPerPage)));

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      {banner.title ? (
        <Banner banner={banner} />
      ) : (
        <>
          <h1 className="text-4xl font-bold tracking-tight">{site.siteName}</h1>
          <p className="mt-3 text-lg text-zinc-600">{site.tagline}</p>
        </>
      )}

      <section aria-labelledby="latest-heading" className="mt-14">
        <h2 id="latest-heading" className="text-xl font-semibold">
          {home.latestPosts}
        </h2>
        <PostList posts={latest} emptyMessage={home.empty} headingLevel="h3" />
      </section>
    </div>
  );
}