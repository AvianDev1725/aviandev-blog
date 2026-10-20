import type { Metadata } from 'next';
import { Suspense } from 'react';
import AuthCard from '@/components/auth-card';
import { getContentByCMS } from '@/lib/content';
import { accountText } from '../text';
import VerifyStatus from './verify-status';

export async function generateMetadata(): Promise<Metadata> {
  const text = await getContentByCMS('web-account', accountText);
  return { title: text.verifyTitle, robots: { index: false, follow: false }, referrer: 'no-referrer' };
}

export default async function VerifyEmailPage() {
  const text = await getContentByCMS('web-account', accountText);
  return (
    <AuthCard title={text.verifyTitle}>
      <Suspense fallback={null}>
        <VerifyStatus text={text} />
      </Suspense>
    </AuthCard>
  );
}