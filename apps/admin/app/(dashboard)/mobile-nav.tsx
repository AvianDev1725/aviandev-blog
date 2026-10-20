'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { LogOut, MoreHorizontal } from 'lucide-react';
import { isActivePath, navItems, type Role, type SidebarLabels } from './nav-items';

const TAB_PATHS = ['/', '/posts', '/content', '/categories'];
const FULL_SCREEN_PAGES = /^\/posts\/(new|\d+)$/;

type Props = {
  user: { name: string; role: Role; roleLabel: string };
  labels: SidebarLabels;
};

export default function MobileNav({ user, labels }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const sheet = useRef<HTMLDivElement>(null);
  const moreButton = useRef<HTMLButtonElement>(null);

  const items = navItems(labels, user.role);
  const tabs = items.filter((item) => TAB_PATHS.includes(item.href));
  const extra = items.filter((item) => !TAB_PATHS.includes(item.href));
  const moreActive = extra.some((item) => isActivePath(pathname, item.href));
  const showTabs = !FULL_SCREEN_PAGES.test(pathname);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMoreOpen(false);
        moreButton.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    sheet.current?.querySelector<HTMLElement>('a, button')?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [moreOpen]);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  const tabClass = (active: boolean) =>
    `flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] font-medium active:bg-zinc-100 ${
      active ? 'text-zinc-900' : 'text-zinc-500'
    }`;

  const iconClass = (active: boolean) =>
    `flex h-7 w-12 items-center justify-center rounded-full transition-colors ${active ? 'bg-zinc-900 text-white' : ''}`;

  return (
    <>
      <header className="sticky top-0 z-30 box-content flex h-14 items-center border-b border-zinc-200 bg-white px-4 pt-[env(safe-area-inset-top)] md:hidden">
        <span className="truncate font-semibold text-zinc-900">{labels.appName}</span>
      </header>

      {showTabs && (
        <nav
          aria-label={labels.navigation}
          className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
        >
          <ul className="grid" style={{ gridTemplateColumns: `repeat(${tabs.length + 1}, minmax(0, 1fr))` }}>
            {tabs.map(({ href, label, icon: Icon }) => {
              const active = isActivePath(pathname, href);
              return (
                <li key={href}>
                  <Link href={href} aria-current={active ? 'page' : undefined} className={tabClass(active)}>
                    <span className={iconClass(active)}>
                      <Icon size={20} aria-hidden />
                    </span>
                    <span className="max-w-full truncate px-1">{label}</span>
                  </Link>
                </li>
              );
            })}
            <li>
              <button
                ref={moreButton}
                type="button"
                onClick={() => setMoreOpen(true)}
                aria-expanded={moreOpen}
                aria-haspopup="dialog"
                className={tabClass(moreActive)}
              >
                <span className={iconClass(moreActive)}>
                  <MoreHorizontal size={20} aria-hidden />
                </span>
                <span>{labels.more}</span>
              </button>
            </li>
          </ul>
        </nav>
      )}

      {moreOpen && (
        <>
          <div className="backdrop fixed inset-0 z-40 bg-black/40 md:hidden" aria-hidden onClick={() => setMoreOpen(false)} />
          <div
            ref={sheet}
            role="dialog"
            aria-label={labels.more}
            className="sheet fixed inset-x-0 bottom-0 z-50 space-y-1 rounded-t-2xl bg-white px-3 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 shadow-2xl md:hidden"
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-zinc-300" aria-hidden />

            <div className="px-3 pb-3">
              <p className="truncate font-medium text-zinc-900">{user.name}</p>
              <p className="text-sm text-zinc-500">{user.roleLabel}</p>
            </div>

            {extra.map(({ href, label, icon: Icon }) => {
              const active = isActivePath(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex h-12 items-center gap-3 rounded-xl px-3 font-medium active:bg-zinc-100 ${
                    active ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-700'
                  }`}
                >
                  <Icon size={20} aria-hidden />
                  {label}
                </Link>
              );
            })}

            <button
              type="button"
              onClick={logout}
              className="flex h-12 w-full items-center gap-3 rounded-xl px-3 font-medium text-zinc-700 active:bg-zinc-100"
            >
              <LogOut size={20} aria-hidden />
              {labels.logout}
            </button>
          </div>
        </>
      )}
    </>
  );
}