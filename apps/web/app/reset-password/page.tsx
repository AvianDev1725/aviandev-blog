import type { Metadata } from 'next';
import { Suspense } from 'react';
import AuthCard from '@/components/auth-card';
import { getContentByCMS } from '@/lib/content';
import { accountText } from '../text';
import ResetForm from './reset-form';

export async function generateMetadata(): Promise<Metadata> {
  const text = await getContentByCMS('web-account', accountText);
  return { title: text.resetTitle, robots: { index: false, follow: false }, referrer: 'no-referrer' };
}

export default async function ResetPasswordPage() {
  const text = await getContentByCMS('web-account', accountText);
  return (
    <AuthCard title={text.resetTitle}>
      <Suspense fallback={null}>
        <ResetForm text={text} />
      </Suspense>
    </AuthCard>
  );
}