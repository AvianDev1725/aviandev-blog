'use client';

import { useState, type FormEvent } from 'react';
import { fill } from '@aviandev/core/text';
import FormError from '@/components/form-error';
import SubmitButton from '@/components/submit-button';
import TextField from '@/components/text-field';
import { postApi } from '@/lib/client';
import type { AccountText } from '../text';

export default function ForgotForm({ text }: { text: AccountText }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [sentTo, setSentTo] = useState('');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get('email') ?? '').trim();
    setBusy(true);
    setError('');
    setFields({});

    const result = await postApi('/readers/forgot-password', { email });
    setBusy(false);
    if (!result.ok) {
      setFields(result.fields);
      return setError(result.error || text.genericError);
    }
    setSentTo(email);
  }

  if (sentTo) {
    return (
      <p role="status" className="rounded-xl bg-emerald-50 p-5 text-emerald-900 ring-1 ring-emerald-200">
        {fill(text.forgotSent, { email: sentTo })}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <FormError message={error} />
      <TextField name="email" type="email" label={text.email} autoComplete="email" required error={fields.email} />
      <SubmitButton busy={busy} label={text.forgotSubmit} busyLabel={text.sending} />
    </form>
  );
}