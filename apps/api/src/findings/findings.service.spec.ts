import { ACTIONABLE_STATUSES, buildFindingsWhere, nextFindingReference, withAgeing } from './findings.service';

const ME = 'user-1';
const NOW = new Date('2026-09-03T06:00:00Z');

describe('buildFindingsWhere', () => {
  it('always excludes soft-deleted findings', () => {
    expect(buildFindingsWhere({}, ME, NOW)).toEqual({ deletedAt: null });
  });

  it('maps simple filters one-to-one', () => {
    const where = buildFindingsWhere({ engagementId: 'e1', entityId: 'en1', status: 'AGREED', severity: 'HIGH', actionOwnerId: 'o1' }, ME, NOW);
    expect(where).toMatchObject({ engagementId: 'e1', entityId: 'en1', status: 'AGREED', severity: 'HIGH', actionOwnerId: 'o1' });
  });

  it('mine=true restricts to findings where I am the action owner', () => {
    expect(buildFindingsWhere({ mine: true }, ME, NOW).actionOwnerId).toBe(ME);
    expect(buildFindingsWhere({ mine: true, actionOwnerId: 'someone-else' }, ME, NOW).actionOwnerId).toBe(ME);
  });

  it('mine=true also matches findings addressed to my email when the actor email is known', () => {
    const where = buildFindingsWhere({ mine: true, actionOwnerId: 'someone-else' }, { id: ME, email: 'Owner@Client.example' }, NOW);
    expect(where.actionOwnerId).toBeUndefined();
    expect(where.AND).toEqual([{ OR: [{ actionOwnerId: ME }, { actionOwnerEmail: { equals: 'Owner@Client.example', mode: 'insensitive' } }] }]);
  });

  it('overdue=true means past due and in an actionable status', () => {
    const where = buildFindingsWhere({ overdue: true }, ME, NOW);
    expect(where.dueDate).toEqual({ lt: NOW });
    expect(where.status).toEqual({ in: ACTIONABLE_STATUSES });
  });

  it('overdue with an explicit status keeps that status', () => {
    const where = buildFindingsWhere({ overdue: true, status: 'VALIDATION' }, ME, NOW);
    expect(where.status).toBe('VALIDATION');
    expect(where.dueDate).toEqual({ lt: NOW });
  });

  it('free text searches title, reference and condition case-insensitively', () => {
    const where = buildFindingsWhere({ q: 'recon' }, ME, NOW);
    expect(where.OR).toHaveLength(3);
    expect(where.OR?.[0]).toEqual({ title: { contains: 'recon', mode: 'insensitive' } });
  });
});

describe('nextFindingReference', () => {
  it('starts at F-01 and increments with two-digit padding', () => {
    expect(nextFindingReference(null)).toBe('F-01');
    expect(nextFindingReference('F-01')).toBe('F-02');
    expect(nextFindingReference('F-09')).toBe('F-10');
    expect(nextFindingReference('F-99')).toBe('F-100');
  });
});

describe('withAgeing', () => {
  it('computes ageing only for actionable statuses', () => {
    const due = new Date('2026-08-01T00:00:00Z');
    expect(withAgeing({ dueDate: due, status: 'IMPLEMENTATION' }, NOW)).toMatchObject({ ageingBucket: '31-60', daysOverdue: 33, isOverdue: true });
    expect(withAgeing({ dueDate: due, status: 'CLOSED' }, NOW)).toMatchObject({ ageingBucket: 'NOT_DUE', daysOverdue: 0, isOverdue: false });
    expect(withAgeing({ dueDate: null, status: 'AGREED' }, NOW)).toMatchObject({ ageingBucket: 'NOT_DUE', daysOverdue: 0 });
  });
});
