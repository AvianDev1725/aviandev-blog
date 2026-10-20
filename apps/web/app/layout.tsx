import { Suspense } from 'react';
import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { getContentByCMS } from '@/lib/content';
import { isSafeLink } from '@aviandev/core/text';
import { accountText, seoText, siteText } from './text';
import { siteUrl } from '@/lib/site';
import AccountMenu from '@/components/account-menu';
import BackButton from '@/components/back-button';
import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#ffffff',
};

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getContentByCMS('web-seo', seoText);
  const favicon = isSafeLink(seo.favicon) ? seo.favicon : undefined;
  const titleTemplate = seo.titleTemplate.includes('%s') ? seo.titleTemplate : `%s · ${seo.defaultTitle}`;
  const appIcon = /^\/media\/[A-Za-z0-9._-]+$/.test(seo.appIcon) ? seo.appIcon : undefined;

  return {
    metadataBase: new URL(siteUrl),
    title: { default: seo.defaultTitle, template: titleTemplate },
    description: seo.description,
    icons: favicon ? { icon: favicon, apple: appIcon ?? favicon } : undefined,
    appleWebApp: { capable: true, title: seo.defaultTitle, statusBarStyle: 'default' },
    robots: seo.allowIndexing ? undefined : { index: false, follow: false },
    openGraph: {
      type: 'website',
      siteName: seo.defaultTitle,
      title: seo.defaultTitle,
      description: seo.description,
      locale: seo.locale,
    },
    twitter: {
      card: 'summary_large_image',
      site: seo.twitterHandle || undefined,
    },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [text, account] = await Promise.all([
    getContentByCMS('web-site', siteText),
    getContentByCMS('web-account', accountText),
  ]);

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col bg-white text-zinc-900 antialiased" suppressHydrationWarning>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-zinc-900 focus:px-4 focus:py-2 focus:text-white"
        >
          {text.skipToContent}
        </a>

        <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white pt-[env(safe-area-inset-top)]">
          <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4 sm:h-16">
            <div className="flex min-w-0 items-center gap-1">
              <Suspense fallback={null}>
                <BackButton label={text.back} />
              </Suspense>
              <Link href="/" className="truncate text-lg font-semibold tracking-tight text-zinc-900">
                {text.siteName}
              </Link>
            </div>
            <div className="flex shrink-0 items-center gap-2 sm:gap-5">
              <nav aria-label={text.navLabel}>
                <Link
                  href="/categories"
                  className="inline-flex h-11 items-center px-2 text-sm font-medium text-zinc-600 hover:text-zinc-900"
                >
                  {text.navTopics}
                </Link>
              </nav>
              <Suspense fallback={<div className="h-11 w-20" aria-hidden />}>
                <AccountMenu text={account} />
              </Suspense>
            </div>
          </div>
        </header>

        <main id="main" className="flex-1">
          {children}
        </main>

        <footer className="border-t border-zinc-200 pb-[env(safe-area-inset-bottom)]">
          <p className="mx-auto max-w-3xl px-4 py-8 text-sm text-zinc-500">{text.footerCopyright}</p>
        </footer>
      </body>
    </html>
  );
}