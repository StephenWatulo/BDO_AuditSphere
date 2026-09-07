import { describe, expect, it } from 'vitest';
import {
  FINDING_WORKFLOW,
  WORKPAPER_WORKFLOW,
  ENGAGEMENT_WORKFLOW,
  findTransition,
  canTransition,
  availableActions,
} from './workflows';
import { ROLE_PERMISSIONS, permissionsForRoles } from './permissions';
import { ageingBucket, escalationLevel } from './ageing';

describe('workflows', () => {
  it('finding follows the required lifecycle', () => {
    expect(canTransition(FINDING_WORKFLOW, 'DRAFT', 'MANAGEMENT_REVIEW')).toBe(true);
    expect(canTransition(FINDING_WORKFLOW, 'MANAGEMENT_REVIEW', 'AGREED')).toBe(true);
    expect(canTransition(FINDING_WORKFLOW, 'AGREED', 'IMPLEMENTATION')).toBe(true);
    expect(canTransition(FINDING_WORKFLOW, 'IMPLEMENTATION', 'VALIDATION')).toBe(true);
    expect(canTransition(FINDING_WORKFLOW, 'VALIDATION', 'CLOSED')).toBe(true);
    expect(canTransition(FINDING_WORKFLOW, 'DRAFT', 'CLOSED')).toBe(false);
  });

  it('workpaper sign-off requires segregation guard', () => {
    const t = findTransition(WORKPAPER_WORKFLOW, 'REVIEWED', 'sign_off');
    expect(t?.guards).toContain('signer_is_not_preparer');
    expect(t?.permission).toBe('workpaper:sign_off');
  });

  it('engagement fieldwork can only move to review', () => {
    const actions = availableActions(ENGAGEMENT_WORKFLOW, 'FIELDWORK').map((a) => a.to);
    expect(actions).toEqual(['REVIEW']);
  });
});

describe('permissions', () => {
  it('junior auditors cannot sign off workpapers', () => {
    expect(ROLE_PERMISSIONS.JUNIOR_AUDITOR).not.toContain('workpaper:sign_off');
    expect(ROLE_PERMISSIONS.AUDIT_MANAGER).toContain('workpaper:sign_off');
  });
  it('business owners can respond but not manage findings', () => {
    const p = permissionsForRoles(['BUSINESS_OWNER']);
    expect(p.has('finding:respond')).toBe(true);
    expect(p.has('finding:manage')).toBe(false);
  });
});

describe('ageing', () => {
  it('buckets overdue days', () => {
    const now = new Date('2026-09-03');
    expect(ageingBucket(new Date('2026-09-10'), now)).toBe('NOT_DUE');
    expect(ageingBucket(new Date('2026-08-20'), now)).toBe('1-30');
    expect(ageingBucket(new Date('2026-01-01'), now)).toBe('180+');
    expect(escalationLevel(60)).toBe(3);
  });
});
