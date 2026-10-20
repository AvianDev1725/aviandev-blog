'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { fill } from '@/lib/text';
import { isActivePath, navItems, type NavBadges, type Role, type SidebarLabels } from './nav-items';

export type { SidebarLabels } from './nav-items';

type SidebarProps = {
  user: { name: string; role: Role; roleLabel: string };
  labels: SidebarLabels;
  initialCollapsed: boolean;
  badges: NavBadges;
};

export default function Sidebar({ user, labels, initialCollapsed, badges }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const items = navItems(labels, user.role);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `sidebar=${next ? 'collapsed' : 'expanded'}; path=/; max-age=31536000; samesite=lax`;
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <aside
      className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-zinc-200 bg-white transition-[width] duration-200 motion-reduce:transition-none md:flex ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      <div
        className={`flex h-14 items-center gap-2 border-b border-zinc-200 px-3 ${
          collapsed ? 'justify-center' : 'justify-between'
        }`}
      >
        {!collapsed && <span className="truncate font-semibold text-zinc-900">{labels.appName}</span>}
        <button
          onClick={toggle}
          aria-label={collapsed ? labels.expand : labels.collapse}
          aria-expanded={!collapsed}
          className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-100"
        >
          {collapsed ? <PanelLeftOpen size={18} aria-hidden /> : <PanelLeftClose size={18} aria-hidden />}
        </button>
      </div>

      <nav aria-label={labels.navigation} className="flex-1 space-y-1 p-2">
        {items.map(({ href, label, icon: Icon }) => {
          const active = isActivePath(pathname, href);
          const badge = badges[href] ?? 0;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              title={collapsed ? label : undefined}
              className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
                active ? 'bg-zinc-900 text-white' : 'text-zinc-700 hover:bg-zinc-100'
              }`}
            >
              <Icon size={18} aria-hidden className="shrink-0" />
              <span className={collapsed ? 'sr-only' : 'truncate'}>{label}</span>
              {badge > 0 && (
                <>
                  <span className="sr-only">, {fill(labels.waitingCount, { count: badge })}</span>
                  {collapsed ? (
                    <span aria-hidden className="absolute right-2 top-1.5 h-2 w-2 rounded-full bg-amber-500" />
                  ) : (
                    <span
                      aria-hidden
                      className="ml-auto rounded-full bg-amber-500 px-1.5 py-0.5 text-xs font-semibold leading-none text-white"
                    >
                      {badge}
                    </span>
                  )}
                </>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-zinc-200 p-2">
        {!collapsed && (
          <div className="px-3 py-2">
            <p className="truncate text-sm font-medium text-zinc-900">{user.name}</p>
            <p className="text-xs text-zinc-500">{user.roleLabel}</p>
          </div>
        )}
        <button
          onClick={logout}
          title={collapsed ? labels.logout : undefined}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
        >
          <LogOut size={18} aria-hidden className="shrink-0" />
          <span className={collapsed ? 'sr-only' : undefined}>{labels.logout}</span>
        </button>
      </div>
    </aside>
  );
}