import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/api';
import { getContentByCMS } from '@/lib/content';
import MobileNav from './mobile-nav';
import Sidebar from './sidebar';
import { shellText } from './text';

export const instant = false;

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role === 'reader') redirect(process.env.BLOG_URL ?? 'http://localhost:3002');

  const [text, cookieStore] = await Promise.all([getContentByCMS('admin-shell', shellText), cookies()]);
  const collapsed = cookieStore.get('sidebar')?.value === 'collapsed';
  const roleLabels = { reader: text.roleReader, admin: text.roleAdmin, super_admin: text.roleSuperAdmin };
  const navUser = { name: user.name, role: user.role, roleLabel: roleLabels[user.role] };

  return (
    <div className="flex min-h-screen bg-zinc-50">
      <Sidebar user={navUser} labels={text} initialCollapsed={collapsed} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav user={navUser} labels={text} />
        <main className="min-w-0 flex-1 p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:p-6">{children}</main>
      </div>
    </div>
  );
}