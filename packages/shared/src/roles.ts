export const ROLE_KEYS = [
  'GLOBAL_ADMIN',
  'AUDIT_PARTNER',
  'CHIEF_AUDIT_EXECUTIVE',
  'AUDIT_MANAGER',
  'SENIOR_AUDITOR',
  'JUNIOR_AUDITOR',
  'BUSINESS_OWNER',
  'MANAGEMENT_REVIEWER',
  'AUDIT_COMMITTEE_VIEWER',
] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

export const ROLE_LABELS: Record<RoleKey, string> = {
  GLOBAL_ADMIN: 'Global Administrator',
  AUDIT_PARTNER: 'Audit Partner',
  CHIEF_AUDIT_EXECUTIVE: 'Chief Audit Executive',
  AUDIT_MANAGER: 'Audit Manager',
  SENIOR_AUDITOR: 'Senior Auditor',
  JUNIOR_AUDITOR: 'Junior Auditor',
  BUSINESS_OWNER: 'Business Owner',
  MANAGEMENT_REVIEWER: 'Management Reviewer',
  AUDIT_COMMITTEE_VIEWER: 'Audit Committee Viewer',
};

/** Roles that belong to the internal audit function (as opposed to auditees and committee). */
export const AUDIT_FUNCTION_ROLES: RoleKey[] = [
  'GLOBAL_ADMIN',
  'AUDIT_PARTNER',
  'CHIEF_AUDIT_EXECUTIVE',
  'AUDIT_MANAGER',
  'SENIOR_AUDITOR',
  'JUNIOR_AUDITOR',
];

/** Roles able to review workpapers. Segregation from the preparer is enforced separately. */
export const REVIEWER_ROLES: RoleKey[] = [
  'AUDIT_PARTNER',
  'CHIEF_AUDIT_EXECUTIVE',
  'AUDIT_MANAGER',
  'SENIOR_AUDITOR',
];
