export const APP_NAME = 'BDO AuditSphere';
export const API_PREFIX = 'api/v1';

export const ENGAGEMENT_STAGES = [
  'PLANNING',
  'RISK_ASSESSMENT',
  'PROGRAMME',
  'FIELDWORK',
  'REVIEW',
  'REPORTING',
  'FOLLOW_UP',
  'CLOSED',
] as const;
export type EngagementStage = (typeof ENGAGEMENT_STAGES)[number];

export const STAGE_LABELS: Record<EngagementStage, string> = {
  PLANNING: 'Planning',
  RISK_ASSESSMENT: 'Risk assessment',
  PROGRAMME: 'Audit programme',
  FIELDWORK: 'Fieldwork',
  REVIEW: 'Review',
  REPORTING: 'Reporting',
  FOLLOW_UP: 'Issue follow-up',
  CLOSED: 'Closed',
};

export const FINDING_STATUSES = [
  'DRAFT',
  'MANAGEMENT_REVIEW',
  'AGREED',
  'IMPLEMENTATION',
  'VALIDATION',
  'CLOSED',
  'RISK_ACCEPTED',
] as const;
export type FindingStatus = (typeof FINDING_STATUSES)[number];

export const WORKPAPER_STATUSES = [
  'DRAFT',
  'PREPARED',
  'IN_REVIEW',
  'REVIEW_NOTES_OPEN',
  'REVIEWED',
  'SIGNED_OFF',
] as const;
export type WorkpaperStatus = (typeof WORKPAPER_STATUSES)[number];

export const PLAN_STATUSES = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ACTIVE', 'ARCHIVED'] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

export const REQUEST_STATUSES = ['OPEN', 'SUBMITTED', 'ACCEPTED', 'RETURNED', 'CANCELLED'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type Severity = (typeof SEVERITIES)[number];

export const ENTITY_TYPES = [
  'LEGAL_ENTITY',
  'BUSINESS_UNIT',
  'COUNTRY',
  'DEPARTMENT',
  'PROCESS',
  'SYSTEM',
  'PRODUCT',
  'THIRD_PARTY',
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const FRAMEWORKS = [
  { code: 'COSO', name: 'COSO Internal Control - Integrated Framework', version: '2013' },
  { code: 'COBIT', name: 'COBIT 2019', version: '2019' },
  { code: 'ISO31000', name: 'ISO 31000 Risk Management', version: '2018' },
  { code: 'ISO27001', name: 'ISO/IEC 27001 Information Security', version: '2022' },
  { code: 'IFRS', name: 'International Financial Reporting Standards', version: '2024' },
  { code: 'SOX', name: 'Sarbanes-Oxley Act s.302/404', version: '2002' },
  { code: 'IIA', name: 'IIA Global Internal Audit Standards', version: '2024' },
] as const;
