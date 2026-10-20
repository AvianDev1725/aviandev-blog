import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getContentByCMS } from '@/lib/content';
import { shellText } from './(dashboard)/text';
import { isSafeLink } from '@aviandev/core/text';
import { adminSeoText } from './seo-text';
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
