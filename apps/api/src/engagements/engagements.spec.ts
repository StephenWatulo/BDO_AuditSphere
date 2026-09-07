import { auditNumberPrefix, formatAuditNumber, nextAuditNumber, parseAuditNumber } from './audit-number';
import { buildEngagementWhere, progressPct } from './engagements.service';

describe('audit number generator', () => {
  it('formats IA-<year>-<3 digit seq>', () => {
    expect(formatAuditNumber(2026, 1)).toBe('IA-2026-001');
    expect(formatAuditNumber(2026, 42)).toBe('IA-2026-042');
    expect(formatAuditNumber(2026, 1000)).toBe('IA-2026-1000');
  });

  it('parses valid numbers and rejects garbage', () => {
    expect(parseAuditNumber('IA-2026-007')).toEqual({ year: 2026, seq: 7 });
    expect(parseAuditNumber('IA-2026-1234')).toEqual({ year: 2026, seq: 1234 });
    expect(parseAuditNumber('IA-26-7')).toBeNull();
    expect(parseAuditNumber('XX-2026-007')).toBeNull();
  });

  it('starts a new year at 001 and continues an existing year', () => {
    expect(nextAuditNumber(2026, null)).toBe('IA-2026-001');
    expect(nextAuditNumber(2026, 'IA-2026-007')).toBe('IA-2026-008');
    expect(nextAuditNumber(2026, 'IA-2025-099')).toBe('IA-2026-001');
    expect(nextAuditNumber(2026, 'IA-2026-999')).toBe('IA-2026-1000');
  });

  it('rejects invalid years and sequences', () => {
    expect(() => formatAuditNumber(26, 1)).toThrow();
    expect(() => formatAuditNumber(2026, 0)).toThrow();
    expect(auditNumberPrefix(2026)).toBe('IA-2026-');
  });
});

describe('buildEngagementWhere', () => {
  it('mine=true matches lead, manager, partner or team membership', () => {
    const where = buildEngagementWhere({ mine: true }, 'me');
    expect(where.OR).toEqual([{ leadId: 'me' }, { managerId: 'me' }, { partnerId: 'me' }, { members: { some: { userId: 'me' } } }]);
  });

  it('combines mine with free text without clobbering the OR', () => {
    const where = buildEngagementWhere({ mine: true, q: 'payroll' }, 'me');
    expect(where.OR).toHaveLength(4);
    expect(where.AND).toHaveLength(1);
  });
});

describe('progressPct', () => {
  it('is 0 without steps and rounds to an integer', () => {
    expect(progressPct(0, 0)).toBe(0);
    expect(progressPct(3, 1)).toBe(33);
    expect(progressPct(4, 4)).toBe(100);
  });
});
