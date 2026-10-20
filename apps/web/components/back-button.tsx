'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

export default function BackButton({ label }: { label: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const firstPath = useRef<string | null>(null);
  const movedWithinSite = useRef(false);

  useEffect(() => {
    if (firstPath.current === null) firstPath.current = pathname;
    else if (pathname !== firstPath.current) movedWithinSite.current = true;
  }, [pathname]);

  if (pathname === '/') return null;

  function goBack() {
    if (movedWithinSite.current) router.back();
    else router.push('/');
  }

  return (
    <button
      type="button"
      onClick={goBack}
      aria-label={label}
      className="-ml-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-zinc-700 active:bg-zinc-100 sm:hover:bg-zinc-100"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="m15 18-6-6 6-6" />
      </svg>
    </button>
  );
}