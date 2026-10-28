'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { postJson } from '@/lib/client';

export default function DismissButton({ query, label }: { query: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const result = await postJson('/insights/search/dismiss', { query });
        setBusy(false);
        if (result.ok) router.refresh();
      }}
      className="h-10 rounded-lg px-3 text-sm font-medium text-zinc-600 ring-1 ring-zinc-200 active:bg-zinc-100 disabled:opacity-60 md:h-8 md:hover:bg-zinc-100"
    >
      {label}
    </button>
  );
}