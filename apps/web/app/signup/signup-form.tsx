'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { fill } from '@aviandev/core/text';
import FormError from '@/components/form-error';
import SubmitButton from '@/components/submit-button';
import TextField from '@/components/text-field';
import { postApi } from '@/lib/client';
import type { AccountText } from '../text';

export default function SignupForm({ text }: { text: AccountText }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [sentTo, setSentTo] = useState('');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '').trim();
    setBusy(true);
    setError('');
    setFields({});

    const result = await postApi('/readers/signup', {
      firstName: form.get('firstName'),
      lastName: form.get('lastName'),
      email,
      password: form.get('password'),
    });
    setBusy(false);
    if (!result.ok) {
      setFields(result.fields);
      return setError(result.error || text.genericError);
    }
    setSentTo(email);
  }

  if (sentTo) {
    return (
      <div role="status" className="space-y-2 rounded-xl bg-emerald-50 p-5 ring-1 ring-emerald-200">
        <h2 className="font-semibold text-emerald-900">{text.checkEmailTitle}</h2>
        <p className="text-emerald-900">{fill(text.checkEmailBody, { email: sentTo })}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <FormError message={error} />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField name="firstName" label={text.firstName} autoComplete="given-name" required error={fields.firstName} />
        <TextField name="lastName" label={text.lastName} autoComplete="family-name" required error={fields.lastName} />
      </div>
      <TextField name="email" type="email" label={text.email} autoComplete="email" required error={fields.email} />
      <TextField
        name="password"
        type="password"
        label={text.password}
        hint={text.passwordHint}
        autoComplete="new-password"
        required
        error={fields.password}
      />
      <SubmitButton busy={busy} label={text.signupSubmit} busyLabel={text.signingUp} />
      <p className="text-sm text-zinc-600">
        {text.haveAccount}{' '}
        <Link href="/login" className="font-medium text-zinc-900 underline underline-offset-2">
          {text.logIn}
        </Link>
      </p>
    </form>
  );
}