import type {
  EngagementStage,
  FindingStatus,
  WorkpaperStatus,
  PlanStatus,
  RequestStatus,
} from './constants';
import type { PermissionKey } from './permissions';

/**
 * Declarative state machines. Each transition names the permission required and
 * optional guard identifiers evaluated by the API (e.g. `all_workpapers_signed_off`).
 * The web app reads the same declarations to render available actions.
 */
export interface Transition<S extends string> {
  from: S;
  to: S;
  action: string;
  label: string;
  permission: PermissionKey;
  guards?: string[];
}

export interface StateMachine<S extends string> {
  name: string;
  initial: S;
  terminal: S[];
  transitions: Transition<S>[];
}

export const ENGAGEMENT_WORKFLOW: StateMachine<EngagementStage> = {
  name: 'engagement',
  initial: 'PLANNING',
  terminal: ['CLOSED'],
  transitions: [
    { from: 'PLANNING', to: 'RISK_ASSESSMENT', action: 'start_risk_assessment', label: 'Start risk assessment', permission: 'engagement:advance_stage', guards: ['has_objectives_and_scope', 'has_lead'] },
    { from: 'RISK_ASSESSMENT', to: 'PROGRAMME', action: 'build_programme', label: 'Build audit programme', permission: 'engagement:advance_stage' },
    { from: 'PROGRAMME', to: 'FIELDWORK', action: 'start_fieldwork', label: 'Start fieldwork', permission: 'engagement:advance_stage', guards: ['programme_approved'] },
    { from: 'FIELDWORK', to: 'REVIEW', action: 'submit_for_review', label: 'Submit for review', permission: 'engagement:advance_stage', guards: ['all_workpapers_prepared'] },
    { from: 'REVIEW', to: 'FIELDWORK', action: 'return_to_fieldwork', label: 'Return to fieldwork', permission: 'workpaper:review' },
    { from: 'REVIEW', to: 'REPORTING', action: 'start_reporting', label: 'Start reporting', permission: 'engagement:advance_stage', guards: ['all_workpapers_signed_off', 'no_open_review_notes'] },
    { from: 'REPORTING', to: 'FOLLOW_UP', action: 'issue_report', label: 'Issue report', permission: 'engagement:issue_report', guards: ['all_findings_agreed_or_accepted'] },
    { from: 'FOLLOW_UP', to: 'CLOSED', action: 'close', label: 'Close engagement', permission: 'engagement:close', guards: ['all_findings_closed'] },
    { from: 'PLANNING', to: 'CLOSED', action: 'cancel', label: 'Cancel engagement', permission: 'engagement:close' },
  ],
};

export const FINDING_WORKFLOW: StateMachine<FindingStatus> = {
  name: 'finding',
  initial: 'DRAFT',
  terminal: ['CLOSED', 'RISK_ACCEPTED'],
  transitions: [
    { from: 'DRAFT', to: 'MANAGEMENT_REVIEW', action: 'submit', label: 'Submit to management', permission: 'finding:submit', guards: ['has_condition_criteria', 'has_recommendation'] },
    { from: 'MANAGEMENT_REVIEW', to: 'DRAFT', action: 'return_to_draft', label: 'Return to draft', permission: 'finding:manage' },
    { from: 'MANAGEMENT_REVIEW', to: 'AGREED', action: 'agree', label: 'Agree finding', permission: 'finding:respond', guards: ['has_management_response', 'has_action_owner_and_due_date'] },
    { from: 'MANAGEMENT_REVIEW', to: 'RISK_ACCEPTED', action: 'accept_risk', label: 'Accept risk', permission: 'finding:accept_risk' },
    { from: 'AGREED', to: 'IMPLEMENTATION', action: 'start_implementation', label: 'Start implementation', permission: 'finding:respond' },
    { from: 'IMPLEMENTATION', to: 'VALIDATION', action: 'request_validation', label: 'Request validation', permission: 'finding:respond', guards: ['has_implementation_evidence'] },
    { from: 'VALIDATION', to: 'IMPLEMENTATION', action: 'reject_validation', label: 'Return to implementation', permission: 'finding:validate' },
    { from: 'VALIDATION', to: 'CLOSED', action: 'validate_and_close', label: 'Validate and close', permission: 'finding:validate' },
  ],
};

export const WORKPAPER_WORKFLOW: StateMachine<WorkpaperStatus> = {
  name: 'workpaper',
  initial: 'DRAFT',
  terminal: ['SIGNED_OFF'],
  transitions: [
    { from: 'DRAFT', to: 'PREPARED', action: 'mark_prepared', label: 'Mark as prepared', permission: 'workpaper:prepare', guards: ['has_procedure_and_conclusion'] },
    { from: 'PREPARED', to: 'DRAFT', action: 'reopen', label: 'Reopen', permission: 'workpaper:prepare' },
    { from: 'PREPARED', to: 'IN_REVIEW', action: 'start_review', label: 'Start review', permission: 'workpaper:review', guards: ['reviewer_is_not_preparer'] },
    { from: 'IN_REVIEW', to: 'REVIEW_NOTES_OPEN', action: 'raise_notes', label: 'Raise review notes', permission: 'workpaper:review' },
    { from: 'REVIEW_NOTES_OPEN', to: 'PREPARED', action: 'address_notes', label: 'Notes addressed', permission: 'workpaper:prepare', guards: ['all_notes_addressed'] },
    { from: 'IN_REVIEW', to: 'REVIEWED', action: 'approve_review', label: 'Approve review', permission: 'workpaper:review', guards: ['no_open_review_notes', 'reviewer_is_not_preparer'] },
    { from: 'REVIEWED', to: 'SIGNED_OFF', action: 'sign_off', label: 'Sign off', permission: 'workpaper:sign_off', guards: ['signer_is_not_preparer'] },
    { from: 'SIGNED_OFF', to: 'DRAFT', action: 'unlock', label: 'Unlock', permission: 'workpaper:unlock' },
  ],
};

export const PLAN_WORKFLOW: StateMachine<PlanStatus> = {
  name: 'audit_plan',
  initial: 'DRAFT',
  terminal: ['ARCHIVED'],
  transitions: [
    { from: 'DRAFT', to: 'PENDING_APPROVAL', action: 'submit', label: 'Submit for approval', permission: 'plan:manage', guards: ['has_items'] },
    { from: 'PENDING_APPROVAL', to: 'DRAFT', action: 'return', label: 'Return to draft', permission: 'plan:approve' },
    { from: 'PENDING_APPROVAL', to: 'APPROVED', action: 'approve', label: 'Approve', permission: 'plan:approve' },
    { from: 'APPROVED', to: 'ACTIVE', action: 'activate', label: 'Activate', permission: 'plan:manage' },
    { from: 'APPROVED', to: 'DRAFT', action: 'reopen', label: 'Reopen', permission: 'plan:approve' },
    { from: 'ACTIVE', to: 'ARCHIVED', action: 'archive', label: 'Archive', permission: 'plan:manage' },
  ],
};

export const REQUEST_WORKFLOW: StateMachine<RequestStatus> = {
  name: 'document_request',
  initial: 'OPEN',
  terminal: ['ACCEPTED', 'CANCELLED'],
  transitions: [
    { from: 'OPEN', to: 'SUBMITTED', action: 'submit', label: 'Submit response', permission: 'request:respond', guards: ['has_attachment_or_response'] },
    { from: 'SUBMITTED', to: 'ACCEPTED', action: 'accept', label: 'Accept', permission: 'request:manage' },
    { from: 'SUBMITTED', to: 'RETURNED', action: 'return', label: 'Return', permission: 'request:manage' },
    { from: 'RETURNED', to: 'SUBMITTED', action: 'resubmit', label: 'Resubmit', permission: 'request:respond', guards: ['has_attachment_or_response'] },
    { from: 'OPEN', to: 'CANCELLED', action: 'cancel', label: 'Cancel', permission: 'request:manage' },
    { from: 'RETURNED', to: 'CANCELLED', action: 'cancel', label: 'Cancel', permission: 'request:manage' },
  ],
};

export function findTransition<S extends string>(
  machine: StateMachine<S>,
  from: S,
  action: string,
): Transition<S> | undefined {
  return machine.transitions.find((t) => t.from === from && t.action === action);
}

export function availableActions<S extends string>(
  machine: StateMachine<S>,
  from: S,
): Transition<S>[] {
  return machine.transitions.filter((t) => t.from === from);
}

export function canTransition<S extends string>(machine: StateMachine<S>, from: S, to: S): boolean {
  return machine.transitions.some((t) => t.from === from && t.to === to);
}

export const WORKFLOWS = {
  engagement: ENGAGEMENT_WORKFLOW,
  finding: FINDING_WORKFLOW,
  workpaper: WORKPAPER_WORKFLOW,
  audit_plan: PLAN_WORKFLOW,
  document_request: REQUEST_WORKFLOW,
} as const;
