import type { Metadata } from 'next';
import AuthCard from '@/components/auth-card';
import { getContentByCMS } from '@/lib/content';
import { accountText } from '../text';
import ForgotForm from './forgot-form';

export async function generateMetadata(): Promise<Metadata> {
  const text = await getContentByCMS('web-account', accountText);
  return { title: text.forgotTitle, robots: { index: false, follow: true } };
}

export default async function ForgotPasswordPage() {
  const text = await getContentByCMS('web-account', accountText);
  return (
    <AuthCard title={text.forgotTitle} intro={text.forgotIntro}>
      <ForgotForm text={text} />
    </AuthCard>
  );
}