import type { Metadata, Viewport } from 'next';
import { isSafeLink } from '@aviandev/core/text';
import { getContentByCMS } from '@/lib/content';
import { adminSeoText } from './seo-text';
import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
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
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}