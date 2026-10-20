import { Blocks, FileText, LayoutDashboard, MessageSquare, Newspaper, Tags, Users, type LucideIcon } from 'lucide-react';

export type Role = 'reader' | 'admin' | 'super_admin';

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles?: Role[];
};

export type SidebarLabels = {
  appName: string;
  dashboard: string;
  team: string;
  categories: string;
  logout: string;
  collapse: string;
  expand: string;
  navigation: string;
  models: string;
  content: string;
  posts: string;
  more: string;
  comments: string;
  waitingCount: string;
};

export type NavBadges = Record<string, number>;

export function navItems(labels: SidebarLabels, role: Role): NavItem[] {
  const items: NavItem[] = [
    { href: '/', label: labels.dashboard, icon: LayoutDashboard },
    { href: '/posts', label: labels.posts, icon: Newspaper },
    { href: '/comments', label: labels.comments, icon: MessageSquare },
    { href: '/content', label: labels.content, icon: FileText },
    { href: '/categories', label: labels.categories, icon: Tags },
    { href: '/models', label: labels.models, icon: Blocks, roles: ['super_admin'] },
    { href: '/team', label: labels.team, icon: Users, roles: ['super_admin'] },
  ];
  return items.filter((item) => !item.roles || item.roles.includes(role));
}

export function isActivePath(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}