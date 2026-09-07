import { buildRequestWhere, nextRequestReference } from './requests.service';

const ME = 'user-1';
const NOW = new Date('2026-09-07T06:00:00Z');

describe('buildRequestWhere', () => {
  it('returns an empty where for no filters', () => {
    expect(buildRequestWhere({}, ME, NOW)).toEqual({});
  });

  it('mine=true restricts to requests assigned to me by id', () => {
    expect(buildRequestWhere({ mine: true }, ME, NOW)).toEqual({ assigneeId: ME });
  });

  it('mine=true also matches requests addressed to my email when the actor email is known', () => {
    const where = buildRequestWhere({ mine: true, q: 'vendor' }, { id: ME, email: 'owner@client.example' }, NOW);
    expect(where.assigneeId).toBeUndefined();
    expect(where.AND).toEqual([{ OR: [{ assigneeId: ME }, { assigneeEmail: { equals: 'owner@client.example', mode: 'insensitive' } }] }]);
    // Free-text search stays on OR and does not clobber the ownership predicate.
    expect(where.OR).toHaveLength(2);
  });

  it('overdue=true means past due and still open unless a status is given', () => {
    expect(buildRequestWhere({ overdue: true }, ME, NOW)).toEqual({ dueDate: { lt: NOW }, status: { in: ['OPEN', 'RETURNED'] } });
    expect(buildRequestWhere({ overdue: true, status: 'RETURNED' }, ME, NOW).status).toBe('RETURNED');
  });
});

describe('nextRequestReference', () => {
  it('starts at DR-01 and increments the numeric suffix', () => {
    expect(nextRequestReference(null)).toBe('DR-01');
    expect(nextRequestReference('DR-09')).toBe('DR-10');
    expect(nextRequestReference('DR-123')).toBe('DR-124');
  });
});
