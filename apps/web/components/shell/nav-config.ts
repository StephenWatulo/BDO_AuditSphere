import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  BarChart3,
  BookOpen,
  Bot,
  Briefcase,
  CalendarRange,
  ClipboardCheck,
  FileSearch,
  Gauge,
  Home,
  Inbox,
  Network,
  ShieldCheck,
  TimerReset,
  Users,
} from 'lucide-react';
import type { PermissionKey } from '@auditsphere/shared';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  permission?: PermissionKey | PermissionKey[];
  /** Match nested routes. */
  prefix?: boolean;
  shortcut?: string;
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    items: [{ label: 'Home', href: '/', icon: Home }],
  },
  {
    label: 'Universe',
    items: [
      { label: 'Audit universe', href: '/universe', icon: Network, permission: 'universe:read', prefix: true, shortcut: 'g u' },
      { label: 'Risks', href: '/risks', icon: Activity, permission: 'risk:read', prefix: true },
      { label: 'Controls', href: '/controls', icon: ShieldCheck, permission: 'control:read', prefix: true },
    ],
  },
  {
    label: 'Delivery',
    items: [
      { label: 'Plans', href: '/plans', icon: CalendarRange, permission: 'plan:read', prefix: true },
      { label: 'Engagements', href: '/engagements', icon: Briefcase, permission: 'engagement:read', prefix: true, shortcut: 'g e' },
      { label: 'Findings', href: '/findings', icon: ClipboardCheck, permission: 'finding:read', prefix: true, shortcut: 'g f' },
      { label: 'Requests', href: '/requests', icon: Inbox, permission: 'request:read', prefix: true },
      { label: 'Resources', href: '/resources', icon: TimerReset, permission: ['time:own', 'resource:read'], prefix: true },
    ],
  },
  {
    label: 'Knowledge',
    items: [
      { label: 'Library', href: '/library', icon: BookOpen, permission: 'library:read', prefix: true },
      { label: 'AI Sphere', href: '/copilot', icon: Bot, permission: 'ai:use', prefix: true },
      { label: 'Reports', href: '/reports', icon: BarChart3, permission: ['report:export', 'dashboard:partner', 'dashboard:committee'], prefix: true },
      { label: 'Monitoring', href: '/monitoring', icon: Gauge, permission: 'monitoring:read', prefix: true },
    ],
  },
  {
    label: 'Admin',
    items: [
      { label: 'Users', href: '/admin/users', icon: Users, permission: 'user:manage', prefix: true },
      { label: 'Audit trail', href: '/admin/audit-trail', icon: FileSearch, permission: 'audit_trail:read', prefix: true },
    ],
  },
];

export function isActivePath(pathname: string, item: NavItem) {
  if (item.href === '/') return pathname === '/';
  return item.prefix ? pathname === item.href || pathname.startsWith(`${item.href}/`) : pathname === item.href;
}
