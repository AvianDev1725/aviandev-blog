import type { Metadata, Viewport } from 'next';
import { isSafeLink } from '@aviandev/core/text';
import { getContentByCMS } from '@/lib/content';
import { themeScript } from '@/lib/theme';
import { adminSeoText } from './seo-text';
import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  // The theme script swaps this to the dark colour at night, so the phone's browser bar matches.
  themeColor: '#ffffff',
};

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getContentByCMS('admin-seo', adminSeoText);
  const favicon = isSafeLink(seo.favicon) ? seo.favicon : undefined;

  return {
    title: seo.title,
    description: seo.description,
    icons: favicon ? { icon: favicon, apple: favicon } : undefined,
    robots: { index: false, follow: false },
  };
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full antialiased">
      <head>
        {/* Picks light or dark before the page paints, so there's no white flash at night. */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}