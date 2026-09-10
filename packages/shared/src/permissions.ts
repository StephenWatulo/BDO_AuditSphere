import type { RoleKey } from './roles';

/**
 * Permission keys follow `<module>:<action>`. They are seeded into the Permission
 * table and attached to roles through the matrix below. The API guards check
 * these keys; the web app uses them to show/hide actions.
 */
export const PERMISSIONS = {
  // Platform administration
  'tenant:manage': 'Manage tenant settings',
  'user:read': 'View users',
  'user:manage': 'Create, update, deactivate users and assign roles',
  'audit_trail:read': 'View audit trail',

  // Audit universe
  'universe:read': 'View audit universe',
  'universe:manage': 'Create and edit universe entities and processes',

  // Risk
  'risk:read': 'View risks and assessments',
  'risk:manage': 'Create and edit risks',
  'risk:assess': 'Perform risk assessments',
  'risk:configure_scoring': 'Configure scoring models and appetite',

  // Controls
  'control:read': 'View controls',
  'control:manage': 'Create and edit controls',
  'control:test': 'Record control tests',

  // Planning
  'plan:read': 'View audit plans',
  'plan:manage': 'Create and edit audit plans',
  'plan:approve': 'Approve audit plans',

  // Engagements
  'engagement:read': 'View engagements',
  'engagement:create': 'Create engagements',
  'engagement:manage': 'Edit engagement profile, team and timeline',
  'engagement:advance_stage': 'Move engagement through lifecycle stages',
  'engagement:close': 'Close engagements',
  'engagement:issue_report': 'Issue final audit report',

  // Programmes and workpapers
  'program:manage': 'Create and edit audit programmes',
  'program:approve': 'Approve audit programmes',
  'workpaper:read': 'View workpapers',
  'workpaper:prepare': 'Create and edit workpapers',
  'workpaper:review': 'Raise/clear review notes and review workpapers',
  'workpaper:sign_off': 'Final sign-off of workpapers',
  'workpaper:unlock': 'Unlock a signed-off workpaper',

  // Evidence and documents
  'document:read': 'View and download documents',
  'document:upload': 'Upload documents',
  'document:delete': 'Delete documents',
  'document:restricted': 'Access RESTRICTED classified documents',

  // Findings
  'finding:read': 'View findings',
  'finding:manage': 'Create and edit findings',
  'finding:submit': 'Submit findings for management review',
  'finding:respond': 'Provide management response',
  'finding:validate': 'Validate remediation and close findings',
  'finding:accept_risk': 'Accept risk on a finding',

  // Requests
  'request:read': 'View document requests',
  'request:manage': 'Raise and manage document requests',
  'request:respond': 'Respond to document requests',

  // Library
  'library:read': 'Browse library',
  'library:contribute': 'Draft library items',
  'library:approve': 'Approve library items',

  // Time and resources
  'time:own': 'Record own time',
  'time:approve': 'Approve timesheets',
  'resource:read': 'View resourcing and utilisation',
  'resource:manage': 'Manage staff allocation and availability',

  // Dashboards
  'dashboard:auditor': 'Auditor dashboard',
  'dashboard:partner': 'Partner dashboard',
  'dashboard:committee': 'Audit committee dashboard',
  'report:export': 'Export reports',

  // AI
  'ai:use': 'Use AI Sphere audit assistant',
  'ai:configure': 'Configure AI settings',

  // Continuous monitoring
  'monitoring:read': 'View monitoring alerts',
  'monitoring:manage': 'Configure connectors and rules',
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;
export const PERMISSION_KEYS = Object.keys(PERMISSIONS) as PermissionKey[];

export function permissionModule(key: PermissionKey): string {
  return key.split(':')[0];
}

const ALL = PERMISSION_KEYS;

const AUDITOR_BASE: PermissionKey[] = [
  'user:read',
  'universe:read',
  'risk:read',
  'control:read',
  'plan:read',
  'engagement:read',
  'workpaper:read',
  'workpaper:prepare',
  'document:read',
  'document:upload',
  'finding:read',
  'finding:manage',
  'request:read',
  'request:manage',
  'library:read',
  'library:contribute',
  'time:own',
  'dashboard:auditor',
  'ai:use',
  'monitoring:read',
];

const SENIOR: PermissionKey[] = [
  ...AUDITOR_BASE,
  'risk:manage',
  'risk:assess',
  'control:manage',
  'control:test',
  'program:manage',
  'workpaper:review',
  'finding:submit',
  'report:export',
];

const MANAGER: PermissionKey[] = [
  ...SENIOR,
  'universe:manage',
  'plan:manage',
  'engagement:create',
  'engagement:manage',
  'engagement:advance_stage',
  'program:approve',
  'workpaper:sign_off',
  'finding:validate',
  'document:delete',
  'time:approve',
  'resource:read',
  'resource:manage',
  'audit_trail:read',
  'monitoring:manage',
];

const CAE: PermissionKey[] = [
  ...MANAGER,
  'plan:approve',
  'engagement:close',
  'engagement:issue_report',
  'workpaper:unlock',
  'finding:accept_risk',
  'risk:configure_scoring',
  'library:approve',
  'document:restricted',
  'dashboard:partner',
  'dashboard:committee',
  'user:manage',
  'ai:configure',
];

const PARTNER: PermissionKey[] = [...CAE];

const BUSINESS_OWNER: PermissionKey[] = [
  'engagement:read',
  'finding:read',
  'finding:respond',
  'request:read',
  'request:respond',
  'document:read',
  'document:upload',
];

const MANAGEMENT_REVIEWER: PermissionKey[] = [
  ...BUSINESS_OWNER,
  'universe:read',
  'risk:read',
  'control:read',
  'plan:read',
  'report:export',
];

const COMMITTEE: PermissionKey[] = [
  'universe:read',
  'risk:read',
  'plan:read',
  'engagement:read',
  'finding:read',
  'dashboard:committee',
  'report:export',
];

function dedupe<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

export const ROLE_PERMISSIONS: Record<RoleKey, PermissionKey[]> = {
  GLOBAL_ADMIN: ALL,
  AUDIT_PARTNER: dedupe(PARTNER),
  CHIEF_AUDIT_EXECUTIVE: dedupe(CAE),
  AUDIT_MANAGER: dedupe(MANAGER),
  SENIOR_AUDITOR: dedupe(SENIOR),
  JUNIOR_AUDITOR: dedupe(AUDITOR_BASE),
  BUSINESS_OWNER: dedupe(BUSINESS_OWNER),
  MANAGEMENT_REVIEWER: dedupe(MANAGEMENT_REVIEWER),
  AUDIT_COMMITTEE_VIEWER: dedupe(COMMITTEE),
};

export function permissionsForRoles(roles: RoleKey[]): Set<PermissionKey> {
  const set = new Set<PermissionKey>();
  for (const r of roles) for (const p of ROLE_PERMISSIONS[r] ?? []) set.add(p);
  return set;
}
