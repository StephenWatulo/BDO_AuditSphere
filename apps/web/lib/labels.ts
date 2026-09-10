import { humanize } from '@/lib/utils';
import type {
  ControlEffectiveness,
  ControlTestResult,
  EngagementRole,
  EngagementType,
  EntityType,
  EvidenceType,
  LibraryItemType,
  LibraryStatus,
  PlanItemSource,
  PlanItemStatus,
  RecommendationStatus,
  RootCauseCategory,
  TaskPriority,
  TaskStatus,
  TimesheetStatus,
  AvailabilityType,
  RiskSignalStatus,
  MonitoringAlertStatus,
} from '@/lib/types';

export const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  LEGAL_ENTITY: 'Legal entity',
  BUSINESS_UNIT: 'Business unit',
  COUNTRY: 'Country',
  DEPARTMENT: 'Department',
  PROCESS: 'Process',
  SYSTEM: 'System',
  PRODUCT: 'Product',
  THIRD_PARTY: 'Third party',
};

export const ENGAGEMENT_TYPE_LABELS: Record<EngagementType, string> = {
  INTERNAL_AUDIT: 'Internal audit',
  OPERATIONAL: 'Operational',
  FINANCIAL: 'Financial',
  COMPLIANCE: 'Compliance',
  IT: 'IT',
  INVESTIGATION: 'Investigation',
  ADVISORY: 'Advisory',
  FOLLOW_UP: 'Follow-up',
  INTEGRATED: 'Integrated',
};

export const ENGAGEMENT_ROLE_LABELS: Record<EngagementRole, string> = {
  PARTNER: 'Partner',
  MANAGER: 'Manager',
  LEAD: 'Lead',
  SENIOR: 'Senior',
  JUNIOR: 'Junior',
  REVIEWER: 'Reviewer',
  SPECIALIST: 'Specialist',
  OBSERVER: 'Observer',
};

export const PLAN_ITEM_SOURCE_LABELS: Record<PlanItemSource, string> = {
  RISK_BASED: 'Risk based',
  MANAGEMENT_REQUEST: 'Management request',
  REGULATORY: 'Regulatory',
  FOLLOW_UP: 'Follow-up',
  AUDIT_COMMITTEE: 'Audit committee',
  ROTATIONAL: 'Rotational',
};

export const PLAN_ITEM_STATUS_LABELS: Record<PlanItemStatus, string> = {
  PROPOSED: 'Proposed',
  PLANNED: 'Planned',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  DEFERRED: 'Deferred',
  CANCELLED: 'Cancelled',
};

export const CONTROL_EFFECTIVENESS_LABELS: Record<ControlEffectiveness, string> = {
  NOT_TESTED: 'Not tested',
  EFFECTIVE: 'Effective',
  PARTIALLY_EFFECTIVE: 'Partially effective',
  INEFFECTIVE: 'Ineffective',
};

export const CONTROL_TEST_RESULT_LABELS: Record<ControlTestResult, string> = {
  NOT_STARTED: 'Not started',
  IN_PROGRESS: 'In progress',
  PASS: 'Pass',
  PASS_WITH_EXCEPTIONS: 'Pass with exceptions',
  FAIL: 'Fail',
};

export const EVIDENCE_TYPE_LABELS: Record<EvidenceType, string> = {
  DOCUMENT: 'Document',
  SCREENSHOT: 'Screenshot',
  SYSTEM_EXTRACT: 'System extract',
  INTERVIEW_NOTE: 'Interview note',
  OBSERVATION: 'Observation',
  RECALCULATION: 'Recalculation',
  CONFIRMATION: 'Confirmation',
  EMAIL: 'Email',
  PHOTO: 'Photo',
  VOICE_NOTE: 'Voice note',
};

export const ROOT_CAUSE_LABELS: Record<RootCauseCategory, string> = {
  PEOPLE: 'People',
  PROCESS: 'Process',
  TECHNOLOGY: 'Technology',
  GOVERNANCE: 'Governance',
  EXTERNAL: 'External',
  DATA: 'Data',
  POLICY: 'Policy',
};

export const RECOMMENDATION_STATUS_LABELS: Record<RecommendationStatus, string> = {
  PROPOSED: 'Proposed',
  AGREED: 'Agreed',
  IN_PROGRESS: 'In progress',
  IMPLEMENTED: 'Implemented',
  VALIDATED: 'Validated',
  NOT_IMPLEMENTED: 'Not implemented',
  SUPERSEDED: 'Superseded',
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: 'To do',
  IN_PROGRESS: 'In progress',
  BLOCKED: 'Blocked',
  DONE: 'Done',
  CANCELLED: 'Cancelled',
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
};

export const TIMESHEET_STATUS_LABELS: Record<TimesheetStatus, string> = {
  OPEN: 'Open',
  SUBMITTED: 'Submitted',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

export const AVAILABILITY_TYPE_LABELS: Record<AvailabilityType, string> = {
  LEAVE: 'Leave',
  TRAINING: 'Training',
  PUBLIC_HOLIDAY: 'Public holiday',
  SECONDMENT: 'Secondment',
  OTHER: 'Other',
};

export const RISK_SIGNAL_STATUS_LABELS: Record<RiskSignalStatus, string> = {
  NEW: 'New',
  REVIEWED: 'Reviewed',
  LINKED: 'Linked',
  DISMISSED: 'Dismissed',
};

export const MONITORING_ALERT_STATUS_LABELS: Record<MonitoringAlertStatus, string> = {
  OPEN: 'Open',
  INVESTIGATING: 'Investigating',
  CONFIRMED: 'Confirmed',
  FALSE_POSITIVE: 'False positive',
  ESCALATED: 'Escalated',
};

export const LIBRARY_TYPE_LABELS: Record<LibraryItemType, string> = {
  AUDIT_PROGRAM: 'Audit programme',
  RISK: 'Risk',
  CONTROL: 'Control',
  TEST_PROCEDURE: 'Test procedure',
  FINDING: 'Finding',
  RECOMMENDATION: 'Recommendation',
  WORKPAPER_TEMPLATE: 'Workpaper template',
  CHECKLIST: 'Checklist',
};

export const LIBRARY_STATUS_LABELS: Record<LibraryStatus, string> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending approval',
  PUBLISHED: 'Published',
  RETIRED: 'Retired',
};

export const FINDING_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  MANAGEMENT_REVIEW: 'Management review',
  AGREED: 'Agreed',
  IMPLEMENTATION: 'Implementation',
  VALIDATION: 'Validation',
  CLOSED: 'Closed',
  RISK_ACCEPTED: 'Risk accepted',
};

export const WORKPAPER_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  PREPARED: 'Prepared',
  IN_REVIEW: 'In review',
  REVIEW_NOTES_OPEN: 'Review notes open',
  REVIEWED: 'Reviewed',
  SIGNED_OFF: 'Signed off',
};

export const REQUEST_STATUS_LABELS: Record<string, string> = {
  OPEN: 'Open',
  SUBMITTED: 'Submitted',
  ACCEPTED: 'Accepted',
  RETURNED: 'Returned',
  CANCELLED: 'Cancelled',
};

export const PLAN_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending approval',
  APPROVED: 'Approved',
  ACTIVE: 'Active',
  ARCHIVED: 'Archived',
};

export const GUARD_LABELS: Record<string, string> = {
  has_objectives_and_scope: 'Objectives and scope are documented',
  has_lead: 'An engagement lead is assigned',
  programme_approved: 'The audit programme is approved',
  all_workpapers_prepared: 'All workpapers are marked as prepared',
  all_workpapers_signed_off: 'All workpapers are signed off',
  no_open_review_notes: 'No review notes are open',
  all_findings_agreed_or_accepted: 'All findings are agreed or risk-accepted',
  all_findings_owned_and_submitted: 'All findings have owners and have been sent for management review',
  has_procedure_and_conclusion: 'Procedure and conclusion are completed',
  reviewer_is_not_preparer: 'The reviewer is not the preparer',
  signer_is_not_preparer: 'The signer is not the preparer',
  all_notes_addressed: 'All review notes have been addressed',
  has_condition_criteria: 'Condition and criteria are documented',
  has_recommendation: 'A recommendation is documented',
  has_management_response: 'Management response is provided',
  has_action_owner_and_due_date: 'Action owner and due date are set',
  has_implementation_evidence: 'Implementation evidence is attached',
  has_attachment_or_response: 'At least one document or a response note is provided',
  has_items: 'The plan contains at least one item',
};

export function guardLabel(guard: string) {
  return GUARD_LABELS[guard] ?? humanize(guard);
}

export function labelFor<T extends string>(map: Partial<Record<T, string>>, value?: T | null): string {
  if (!value) return '—';
  return map[value] ?? humanize(value);
}

export function enumOptions<T extends string>(map: Record<T, string>) {
  return (Object.keys(map) as T[]).map((value) => ({ value, label: map[value] }));
}
