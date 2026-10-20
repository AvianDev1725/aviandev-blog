'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import Avatar from '@/components/avatar';
import { postApi } from '@/lib/client';
import type { AccountText } from '@/app/text';

type Me = {
  name: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  emailVerifiedAt: string | null;
};

export default function AccountMenu({ text }: { text: AccountText }) {
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [resent, setResent] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/auth/session', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setMe(data?.user ?? null))
      .catch(() => setMe(null));
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function logOut() {
    await postApi('/auth/logout');
    window.location.reload();
  }

  async function resend() {
    const result = await postApi('/readers/resend-verification');
    if (result.ok) setResent(true);
  }

  if (me === undefined) return <div className="h-9 w-32" aria-hidden />;

  if (me === null) {
    const authPage = ['/login', '/signup', '/forgot-password', '/reset-password', '/verify-email'].includes(pathname);
    const loginHref = authPage ? '/login' : `/login?next=${encodeURIComponent(pathname)}`;
    return (
      <div className="flex h-9 items-center gap-3 text-sm">
        <Link href={loginHref} className="font-medium text-zinc-700 hover:text-zinc-900">
          {text.logIn}
        </Link>
        <Link href="/signup" className="rounded-full bg-zinc-900 px-3.5 py-1.5 font-medium text-white hover:bg-zinc-700">
          {text.signUp}
        </Link>
      </div>
    );
  }

  return (
    <div ref={container} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={text.accountMenu}
        className="flex h-9 items-center gap-2 rounded-full pr-2 hover:bg-zinc-100"
      >
        <Avatar size="sm" {...me} />
        <span className="hidden text-sm font-medium sm:inline">{me.firstName ?? me.name}</span>
        {!me.emailVerifiedAt && <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden />}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-72 space-y-3 rounded-xl bg-white p-4 text-sm shadow-lg ring-1 ring-zinc-200">
          <div>
            <p className="font-medium text-zinc-900">{me.name}</p>
            <p className="truncate text-zinc-500">{me.email}</p>
          </div>

          {!me.emailVerifiedAt && (
            <div className="space-y-2 rounded-lg bg-amber-50 p-3 text-amber-900 ring-1 ring-amber-200">
              <p>{text.unverifiedNotice}</p>
              {resent ? (
                <p role="status" className="font-medium">
                  {text.resent}
                </p>
              ) : (
                <button type="button" onClick={resend} className="font-medium underline underline-offset-2">
                  {text.resend}
                </button>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={logOut}
            className="w-full rounded-lg px-3 py-2 text-left font-medium ring-1 ring-zinc-200 hover:bg-zinc-50"
          >
            {text.logOut}
          </button>
        </div>
      )}
    </div>
  );
}