import type { FindingStatus, RequestStatus } from '@/lib/types';

/** Workspace deep links (as stored on notifications) mapped onto their portal equivalents. */
export function portalLink(link: string): string {
  const request = /^\/requests\/([^/?#]+)/.exec(link);
  if (request) return `/portal/requests/${request[1]}`;
  const finding = /^\/findings\/([^/?#]+)/.exec(link);
  if (finding) return `/portal/actions/${finding[1]}`;
  if (link === '/requests') return '/portal/requests';
  if (link === '/findings') return '/portal/actions';
  return link;
}

export const REQUEST_ACTION_STATUSES: RequestStatus[] = ['OPEN', 'RETURNED'];
export const REQUEST_DONE_STATUSES: RequestStatus[] = ['ACCEPTED', 'CANCELLED'];

export function requestNeedsAction(status: RequestStatus): boolean {
  return REQUEST_ACTION_STATUSES.includes(status);
}

export function requestNextStep(status: RequestStatus): string {
  switch (status) {
    case 'OPEN':
      return 'Upload the documents and submit';
    case 'RETURNED':
      return 'Returned by the audit team. Update and resubmit';
    case 'SUBMITTED':
      return 'With the audit team for review';
    case 'ACCEPTED':
      return 'Accepted. Nothing more to do';
    case 'CANCELLED':
      return 'Cancelled by the audit team';
    default:
      return '';
  }
}

export const FINDING_RESPONSE_STATUSES: FindingStatus[] = ['MANAGEMENT_REVIEW'];
export const FINDING_PROGRESS_STATUSES: FindingStatus[] = ['AGREED', 'IMPLEMENTATION'];
export const FINDING_VALIDATION_STATUSES: FindingStatus[] = ['VALIDATION'];
export const FINDING_CLOSED_STATUSES: FindingStatus[] = ['CLOSED', 'RISK_ACCEPTED'];

/** Statuses in which the business owner is expected to do something. */
export function findingNeedsAction(status: FindingStatus): boolean {
  return FINDING_RESPONSE_STATUSES.includes(status) || FINDING_PROGRESS_STATUSES.includes(status);
}

export function findingNextStep(status: FindingStatus): string {
  switch (status) {
    case 'DRAFT':
      return 'Being prepared by the audit team';
    case 'MANAGEMENT_REVIEW':
      return 'Your management response is needed';
    case 'AGREED':
      return 'Agreed. Start the implementation when work begins';
    case 'IMPLEMENTATION':
      return 'Attach evidence of the action taken and request validation';
    case 'VALIDATION':
      return 'With the audit team for validation';
    case 'CLOSED':
      return 'Validated and closed';
    case 'RISK_ACCEPTED':
      return 'Risk accepted by management';
    default:
      return '';
  }
}
