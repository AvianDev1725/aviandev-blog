'use client';

import { useState, type ChangeEvent } from 'react';
import { uploadFile } from '@/lib/client';
import type { ContentText } from './text';

type Props = { inputId: string; text: ContentText; onUploaded: (url: string) => void };

export default function ImageUpload({ inputId, text, onUploaded }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function choose(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setBusy(true);
    setError('');
    const result = await uploadFile(file);
    setBusy(false);

    if (!result.ok) return setError(result.error || text.uploadFailed);
    onUploaded(result.data.url);
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-3">
      <label className="cursor-pointer rounded-lg px-3 py-1.5 text-sm ring-1 ring-zinc-300 hover:bg-zinc-100 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-zinc-900">
        {busy ? text.uploading : text.upload}
        <input
          id={inputId}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml,image/x-icon,.ico"
          onChange={choose}
          disabled={busy}
          className="sr-only"
        />
      </label>
      <span className="text-xs text-zinc-500">{text.uploadHelp}</span>
      {error && (
        <span role="alert" className="text-sm text-red-600">
          {error}
        </span>
      )}
    </div>
  );
}