'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import SubmitButton from '@/components/submit-button';
import TextField from '@/components/text-field';
import { postApi } from '@/lib/client';
import { useLinkToken } from '@/lib/use-link-token';
import type { AccountText } from '../text';

export default function ResetForm({ text }: { text: AccountText }) {
  const token = useLinkToken();
  const [busy, setBusy] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [invalid, setInvalid] = useState(!token);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setPasswordError('');

    const result = await postApi('/readers/reset-password', {
      token,
      password: new FormData(event.currentTarget).get('password'),
    });
    if (result.ok) return window.location.assign('/');

    setBusy(false);
    // Only a truly bad or already-used link shows the "expired" screen.
    if (result.code === 'invalid_link') return setInvalid(true);
    // Every other error (weak password, too many tries, server problem) shows under the box.
    setPasswordError(result.fields.password || result.error || text.genericError);
  }

  if (invalid) {
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">{text.invalidLinkTitle}</h2>
        <p className="text-zinc-600">{text.invalidLinkBody}</p>
        <Link href="/forgot-password" className="inline-block font-medium underline underline-offset-2">
          {text.invalidResetAction}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <TextField
        name="password"
        type="password"
        label={text.newPassword}
        hint={text.passwordHint}
        autoComplete="new-password"
        required
        error={passwordError}
      />
      <SubmitButton busy={busy} label={text.resetSubmit} busyLabel={text.saving} />
    </form>
  );
}