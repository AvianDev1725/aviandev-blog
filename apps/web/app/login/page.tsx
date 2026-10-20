import type { Metadata } from 'next';
import { Suspense } from 'react';
import AuthCard from '@/components/auth-card';
import { getContentByCMS } from '@/lib/content';
import { accountText } from '../text';
import LoginForm from './login-form';

export async function generateMetadata(): Promise<Metadata> {
  const text = await getContentByCMS('web-account', accountText);
  return { title: text.loginTitle, robots: { index: false, follow: true } };
}

export default async function LoginPage() {
  const text = await getContentByCMS('web-account', accountText);
  return (
    <AuthCard title={text.loginTitle} intro={text.loginIntro}>
      <Suspense fallback={null}>
        <LoginForm text={text} />
      </Suspense>
    </AuthCard>
  );
}