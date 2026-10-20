import type { Metadata } from 'next';
import Link from 'next/link';
import { getContentByCMS } from '@/lib/content';
import { siteText } from './text';
import { siteUrl } from '@/lib/site';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const text = await getContentByCMS('web-site', siteText);
  return {
    metadataBase: new URL(siteUrl),
    title: { default: text.siteName, template: `%s · ${text.siteName}` },
    description: text.tagline,
    openGraph: {
      type: 'website',
      siteName: text.siteName,
      title: text.siteName,
      description: text.tagline,
      locale: 'en_IN',
    },
    twitter: { card: 'summary_large_image' },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const text = await getContentByCMS('web-site', siteText);

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
          <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-5">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              {text.siteName}
            </Link>
            <nav aria-label={text.navLabel}>
              <Link href="/categories" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
                {text.navTopics}
              </Link>
            </nav>
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