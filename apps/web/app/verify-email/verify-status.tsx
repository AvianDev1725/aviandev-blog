'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { postApi } from '@/lib/client';
import { useLinkToken } from '@/lib/use-link-token';
import type { AccountText } from '../text';

type State = 'working' | 'done' | 'invalid';

export default function VerifyStatus({ text }: { text: AccountText }) {
  const token = useLinkToken();
  const [state, setState] = useState<State>(token ? 'working' : 'invalid');
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    postApi('/readers/verify-email', { token }).then((result) => setState(result.ok ? 'done' : 'invalid'));
  }, [token]);

  if (state === 'working') return <p role="status" className="text-zinc-600">{text.verifying}</p>;

  if (state === 'invalid') {
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">{text.invalidLinkTitle}</h2>
        <p className="text-zinc-600">{text.invalidLinkBody}</p>
        <Link href="/login" className="inline-block font-medium underline underline-offset-2">
          {text.invalidVerifyAction}
        </Link>
      </div>
    );
  }

  return (
    <div role="status" className="space-y-4 rounded-xl bg-emerald-50 p-5 ring-1 ring-emerald-200">
      <h2 className="font-semibold text-emerald-900">{text.verifiedTitle}</h2>
      <p className="text-emerald-900">{text.verifiedBody}</p>
      <a href="/" className="inline-block rounded-lg bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-700">
        {text.continueToBlog}
      </a>
    </div>
  );
}