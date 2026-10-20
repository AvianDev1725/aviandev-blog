import type { Metadata } from 'next';
import AuthCard from '@/components/auth-card';
import { getContentByCMS } from '@/lib/content';
import { accountText } from '../text';
import SignupForm from './signup-form';

export async function generateMetadata(): Promise<Metadata> {
  const text = await getContentByCMS('web-account', accountText);
  return { title: text.signupTitle, robots: { index: false, follow: true } };
}

export default async function SignupPage() {
  const text = await getContentByCMS('web-account', accountText);
  return (
    <AuthCard title={text.signupTitle} intro={text.signupIntro}>
      <SignupForm text={text} />
    </AuthCard>
  );
}