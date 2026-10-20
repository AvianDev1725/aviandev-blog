import type { Metadata } from 'next';
import Link from 'next/link';
import { getContentByCMS } from '@/lib/content';
import { isSafeLink } from '@aviandev/core/text';
import { accountText, seoText, siteText } from './text';
import { siteUrl } from '@/lib/site';
import AccountMenu from '@/components/account-menu';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getContentByCMS('web-seo', seoText);
  const favicon = isSafeLink(seo.favicon) ? seo.favicon : undefined;
  const titleTemplate = seo.titleTemplate.includes('%s') ? seo.titleTemplate : `%s · ${seo.defaultTitle}`;

  return {
    metadataBase: new URL(siteUrl),
    title: { default: seo.defaultTitle, template: titleTemplate },
    description: seo.description,
    icons: favicon ? { icon: favicon, apple: favicon } : undefined,
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
    <html lang="en">
      <body className="flex min-h-screen flex-col bg-white text-zinc-900 antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-zinc-900 focus:px-4 focus:py-2 focus:text-white"
        >
          {text.skipToContent}
        </a>

        <header className="border-b border-zinc-200">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-5">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              {text.siteName}
            </Link>
            <div className="flex items-center gap-6">
              <nav aria-label={text.navLabel}>
                <Link href="/categories" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
                  {text.navTopics}
                </Link>
              </nav>
              <AccountMenu text={account} />
            </div>
          </div>
        </header>

        <main id="main" className="flex-1">
          {children}
        </main>

        <footer className="border-t border-zinc-200">
          <p className="mx-auto max-w-3xl px-4 py-8 text-sm text-zinc-500">{text.footerCopyright}</p>
        </footer>
      </body>
    </html>
  );
}