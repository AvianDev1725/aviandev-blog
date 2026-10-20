'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import FormError from '@/components/form-error';
import SubmitButton from '@/components/submit-button';
import TextField from '@/components/text-field';
import { postApi, safeNext } from '@/lib/client';
import type { AccountText } from '../text';

export default function LoginForm({ text }: { text: AccountText }) {
  const searchParams = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    setFields({});

    const result = await postApi('/auth/login', { email: form.get('email'), password: form.get('password') });
    if (!result.ok) {
      setBusy(false);
      setFields(result.fields);
      return setError(result.error || text.genericError);
    }
    window.location.assign(safeNext(searchParams.get('next')));
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <FormError message={error} />
      <TextField name="email" type="email" label={text.email} autoComplete="email" required error={fields.email} />
      <TextField
        name="password"
        type="password"
        label={text.password}
        autoComplete="current-password"
        required
        error={fields.password}
      />
      <SubmitButton busy={busy} label={text.logIn} busyLabel={text.loggingIn} />
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <Link href="/forgot-password" className="text-zinc-600 underline underline-offset-2 hover:text-zinc-900">
          {text.forgotLink}
        </Link>
        <span className="text-zinc-600">
          {text.noAccount}{' '}
          <Link href="/signup" className="font-medium text-zinc-900 underline underline-offset-2">
            {text.signUp}
          </Link>
        </span>
      </div>
    </form>
  );
}