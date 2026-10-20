'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import Avatar from '@/components/avatar';
import { getSession, postApi, type SessionUser } from '@/lib/client';
import type { AccountText } from '@/app/text';

type Me = SessionUser;

const AUTH_PAGES = ['/login', '/signup', '/forgot-password', '/reset-password', '/verify-email'];

export default function AccountMenu({ text }: { text: AccountText }) {
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [resent, setResent] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getSession().then(setMe);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    const onPointer = (event: MouseEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);

    const isPhone = window.matchMedia('(max-width: 639px)').matches;
    const previousOverflow = document.body.style.overflow;
    if (isPhone) document.body.style.overflow = 'hidden';

    panel.current?.querySelector<HTMLElement>('button, a')?.focus();

    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
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

  if (me === undefined) return <div className="h-11 w-20" aria-hidden />;

  if (me === null) {
    const loginHref = AUTH_PAGES.includes(pathname) ? '/login' : `/login?next=${encodeURIComponent(pathname)}`;
    return (
      <div className="flex items-center gap-1 text-sm sm:gap-3">
        <Link href={loginHref} className="inline-flex h-11 items-center px-2 font-medium text-zinc-700 hover:text-zinc-900">
          {text.logIn}
        </Link>
        <Link
          href="/signup"
          className="hidden h-9 items-center rounded-full bg-zinc-900 px-4 font-medium text-white hover:bg-zinc-700 sm:inline-flex"
        >
          {text.signUp}
        </Link>
      </div>
    );
  }

  return (
    <div ref={container} className="relative">
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={text.accountMenu}
        className="flex h-11 items-center gap-2 rounded-full pl-1 pr-1 active:bg-zinc-100 sm:pr-3 sm:hover:bg-zinc-100"
      >
        <span className="relative">
          <Avatar size="sm" name={me.name} firstName={me.firstName} lastName={me.lastName} />
          {!me.emailVerifiedAt && (
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-white" aria-hidden />
          )}
        </span>
        <span className="hidden text-sm font-medium sm:inline">{me.firstName ?? me.name}</span>
      </button>

      {open && (
        <>
          <div className="backdrop fixed inset-0 z-40 bg-black/40 sm:hidden" aria-hidden onClick={() => setOpen(false)} />
          <div
            ref={panel}
            role="dialog"
            aria-label={text.accountMenu}
            className="sheet fixed inset-x-0 bottom-0 z-50 space-y-4 rounded-t-2xl bg-white px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 shadow-2xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-full sm:mt-2 sm:w-72 sm:space-y-3 sm:rounded-xl sm:p-4 sm:shadow-lg sm:ring-1 sm:ring-zinc-200"
          >
            <div className="mx-auto h-1.5 w-10 rounded-full bg-zinc-300 sm:hidden" aria-hidden />

            <div className="flex items-center gap-3">
              <Avatar name={me.name} firstName={me.firstName} lastName={me.lastName} />
              <div className="min-w-0">
                <p className="truncate font-medium text-zinc-900">{me.name}</p>
                <p className="truncate text-sm text-zinc-500">{me.email}</p>
              </div>
            </div>

            {!me.emailVerifiedAt && (
              <div className="space-y-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
                <p>{text.unverifiedNotice}</p>
                {resent ? (
                  <p role="status" className="font-medium">
                    {text.resent}
                  </p>
                ) : (
                  <button type="button" onClick={resend} className="py-1 font-medium underline underline-offset-2">
                    {text.resend}
                  </button>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={logOut}
              className="flex h-12 w-full items-center rounded-xl px-4 text-left font-medium ring-1 ring-zinc-200 active:bg-zinc-100 sm:h-10 sm:rounded-lg sm:px-3 sm:text-sm sm:hover:bg-zinc-50"
            >
              {text.logOut}
            </button>
          </div>
        </>
      )}
    </div>
  );
}