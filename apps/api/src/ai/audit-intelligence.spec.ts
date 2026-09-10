import {
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AssistantContentSchema, type AuditSourceKind } from '@auditsphere/shared';
import { AiFeature, CopilotRequestDto } from './ai.dto';
import { AuditRecord } from './audit-context.types';
import { interpretIntelligenceQuery, searchAuditIntelligence } from './audit-intelligence.engine';
import {
  AuditUniverseIndex,
  AuditUniverseIndexService,
  linkAuditRecords,
} from './audit-universe-index.service';
import { AuthUser } from '../auth/auth.types';

const now = new Date('2026-09-08T12:00:00.000Z');
function record(kind: AuditSourceKind, id: string, fields: Record<string, unknown>): AuditRecord {
  return {
    source: {
      id,
      recordId: id,
      kind,
      label: String(fields.title ?? fields.name ?? fields.reference ?? id),
      href: `/test/${id}`,
      excerpt: JSON.stringify(fields),
      truncated: false,
    },
    fields: { id, ...fields },
  };
}
function fixture(extra: AuditRecord[] = []): AuditUniverseIndex {
  const records = [
    record('Entity', 'entity', { name: 'ABC Manufacturing Limited' }),
    record('Process', 'process', { name: 'Procurement', entityId: 'entity' }),
    record('Engagement', 'eng1', {
      auditNumber: 'IA-2026-020',
      title: 'Procurement and Accounts Payable Controls Review',
      entityId: 'entity',
      status: 'COMPLETED',
    }),
    record('Engagement', 'eng2', {
      auditNumber: 'IA-2026-021',
      title: 'Other audit',
      entityId: 'entity',
      status: 'ACTIVE',
    }),
    record('Risk', 'risk1', {
      code: 'RISK-ABC-001',
      title: 'Unauthorised procurement commitments',
      processId: 'process',
      entityId: 'entity',
      rating: 'MEDIUM',
    }),
    record('Risk', 'risk-unrelated', { title: 'Completely separate risk', entityId: 'entity' }),
    record('Control', 'control1', {
      code: 'CTRL-ABC-001',
      title: 'Purchase requisition and purchase order approval',
      processId: 'process',
      effectiveness: 'INEFFECTIVE',
      risks: [{ riskId: 'risk1' }],
    }),
    record('Procedure', 'procedure', {
      objective: 'Check approvals',
      controlId: 'control1',
      engagementId: 'eng1',
    }),
    record('Workpaper', 'wp1', {
      reference: 'WP-01',
      programStepId: 'procedure',
      engagementId: 'eng1',
      title: 'Sample results',
      conclusion: 'Missing authority validation',
    }),
    record('Finding', 'f1', {
      reference: 'F-01',
      title: 'Incomplete procurement approval evidence and authority validation',
      workpaperId: 'wp1',
      engagementId: 'eng1',
      severity: 'MEDIUM',
      ownerName: 'Susan Finance Manager',
      status: 'CLOSED',
      closedAt: '2026-08-10T00:00:00.000Z',
      createdAt: '2026-01-05T00:00:00.000Z',
    }),
    record('Finding', 'f2', {
      reference: 'F-02',
      title: 'Delegation weakness',
      controlId: 'control1',
      engagementId: 'eng2',
      severity: 'HIGH',
      status: 'IMPLEMENTATION',
      dueDate: '2026-08-20T00:00:00.000Z',
      createdAt: '2026-05-10T00:00:00.000Z',
    }),
    record('Document', 'doc1', {
      fileName: 'Invoices.csv',
      extractedText: 'Supplier F approval missing KES 650,000',
    }),
    record('Evidence', 'ev1', {
      description: 'Invoices',
      documentId: 'doc1',
      workpaperId: 'wp1',
      engagementId: 'eng1',
      findings: [{ id: 'f1' }],
    }),
    record('ActionPlan', 'a1', {
      findingId: 'f2',
      text: 'Implement retained approval evidence',
      ownerName: 'Susan Finance Manager',
      status: 'IN_PROGRESS',
      progressPct: 40,
      dueDate: '2026-09-20T00:00:00.000Z',
    }),
    record('ActionPlan', 'a2', {
      findingId: 'f1',
      text: 'Completed validation',
      ownerName: 'Susan Finance Manager',
      status: 'VALIDATED',
      dueDate: '2026-08-01T00:00:00.000Z',
    }),
    record('ControlTest', 'test1', {
      controlId: 'control1',
      engagementId: 'eng1',
      workpaperId: 'wp1',
      result: 'FAIL',
      exceptions: 2,
      testedAt: '2026-03-01T00:00:00.000Z',
    }),
    ...extra,
  ];
  return {
    records,
    links: linkAuditRecords(records),
    warnings: [],
    restrictedKinds: [],
    incompleteKinds: [],
    indexedAt: now.toISOString(),
    textLimitedRecords: 0,
  };
}
const input = (prompt: string, options: Partial<CopilotRequestDto> = {}): CopilotRequestDto => ({
  feature: AiFeature.NaturalLanguageSearch,
  prompt,
  ...options,
});
function search(prompt: string, index = fixture(), options: Partial<CopilotRequestDto> = {}) {
  const result = searchAuditIntelligence(input(prompt, options), index, now);
  expect(AssistantContentSchema.safeParse(result.draft).success).toBe(true);
  return result.context.search!.intelligence!;
}

describe('Audit Intelligence acceptance', () => {
  it('does not spread procurement topics through general entity objectives or a mixed-scope audit', () => {
    const index = fixture([
      record('Process', 'payroll', { name: 'Payroll', entityId: 'entity' }),
      record('Engagement', 'mixed', { title: 'Procurement and payroll review', entityId: 'entity', status: 'COMPLETED' }),
      record('Finding', 'payroll-finding', { title: 'Payroll headcount reconciliation', processId: 'payroll', engagementId: 'mixed', status: 'CLOSED' }),
    ]);
    index.records.find((r) => r.source.id === 'entity')!.fields.strategicObjectives = ['Modernise procurement'];
    expect(search('Show procurement findings', index).rows.map((r) => r.sourceId)).not.toContain('payroll-finding');
  });
  it('does not treat a closed finding as a completed parent audit', () => {
    const index = fixture(); index.records.find((r) => r.source.id === 'eng1')!.fields.status = 'ACTIVE';
    expect(search('Show procurement findings across completed audits', index).rows.map((r) => r.sourceId)).not.toContain('f1');
    expect(search('Show procurement findings', index).rows.map((r) => r.sourceId)).toContain('f1');
  });
  it('honours closed status and low severity rather than silently dropping them', () => {
    expect(search('Show all closed findings').rows.map((r) => r.sourceId)).toEqual(['f1']);
    expect(search('Show all low-risk findings').rows).toEqual([]);
  });
  it('honours negative relationship and exception predicates', () => {
    expect(search('Which risks have no linked findings?').rows.map((r) => r.sourceId)).toEqual([
      'risk-unrelated',
    ]);
    const index = fixture([
      record('Control', 'clean', { title: 'Approval control' }),
      record('ControlTest', 'clean-test', {
        controlId: 'clean',
        result: 'PASS',
        exceptions: 0,
        testedAt: '2026-01-01T00:00:00.000Z',
      }),
    ]);
    expect(
      search('Show controls without exceptions in the last year', index).rows.map(
        (r) => r.sourceId,
      ),
    ).toEqual(['clean']);
  });
  it('rejects unsupported negation rather than silently returning the opposite answer', () => {
    expect(() => search('Show findings excluding procurement')).toThrow(BadRequestException);
  });
  it('returns procurement findings in completed audits with exact recorded owner and closure status', () => {
    const result = search(
      'Show me all procurement-related findings identified across completed audits.',
    );
    expect(result.totalMatches).toBe(1);
    expect(result.rows[0]).toMatchObject({
      sourceId: 'f1',
      severity: 'MEDIUM',
      owner: 'Susan Finance Manager',
      status: 'CLOSED',
      engagement: 'IA-2026-020',
    });
    expect(result.rows[0].traceIds).toEqual(
      expect.arrayContaining(['wp1', 'ev1', 'doc1', 'risk1', 'control1']),
    );
  });
  it('finds risk-to-control-to-procedure-to-workpaper-to-finding links, not common entity siblings', () => {
    const result = search('Which risks have linked findings?');
    expect(result.rows.map((r) => r.sourceId)).toEqual(['risk1']);
    expect(result.rows[0].traceIds).toContain('f1');
  });
  it('returns open audit actions with owners and due dates', () => {
    expect(search('Show me all open audit actions with owners and due dates.').rows).toEqual([
      expect.objectContaining({
        sourceId: 'a1',
        owner: 'Susan Finance Manager',
        status: 'IN_PROGRESS',
        dueDate: '2026-09-20T00:00:00.000Z',
      }),
    ]);
  });
  it('returns recurring control weaknesses without asserting a confirmed common cause', () => {
    const result = search('Which controls have recurring weaknesses?');
    expect(result.rows.map((r) => r.sourceId)).toEqual(['control1']);
    expect(result.rows[0].detail).toContain('common cause requires validation');
  });
  it('handles high-risk as a severity modifier, not the requested object type', () => {
    expect(
      search('Show all high-risk findings that are overdue.').rows.map((r) => r.sourceId),
    ).toEqual(['f2']);
  });
  it('finds risks with ineffective controls and unresolved issues', () => {
    expect(search('Which risks have ineffective controls?').rows.map((r) => r.sourceId)).toEqual([
      'risk1',
    ]);
    expect(search('Which risks have unresolved issues?').rows.map((r) => r.sourceId)).toEqual([
      'risk1',
    ]);
  });
  it('uses a qualifying failed test within the requested period', () => {
    const index = fixture([
      record('Control', 'control2', { title: 'Old failed control' }),
      record('ControlTest', 'old', {
        controlId: 'control2',
        result: 'FAIL',
        exceptions: 2,
        testedAt: '2024-01-01T00:00:00.000Z',
      }),
      record('ControlTest', 'new', {
        controlId: 'control2',
        result: 'PASS',
        exceptions: 0,
        testedAt: '2026-01-01T00:00:00.000Z',
      }),
    ]);
    expect(
      search('Which controls failed testing in the last year?', index).rows.map((r) => r.sourceId),
    ).toEqual(['control1']);
  });
  it('finds actions due this month and includes implemented actions awaiting validation', () => {
    const index = fixture([
      record('ActionPlan', 'a3', {
        findingId: 'f2',
        status: 'IMPLEMENTED',
        dueDate: '2026-09-01T00:00:00.000Z',
      }),
      record('ActionPlan', 'a4', {
        findingId: 'f2',
        status: 'IN_PROGRESS',
        dueDate: '2026-10-01T00:00:00.000Z',
      }),
    ]);
    expect(
      search('Which audit actions are due this month?', index)
        .rows.map((r) => r.sourceId)
        .sort(),
    ).toEqual(['a1', 'a3']);
  });
  it('expands approval weaknesses to delegation and missing authorisation evidence', () => {
    expect(
      search('Show me approval weaknesses', fixture(), { searchKinds: ['Finding'] })
        .rows.map((r) => r.sourceId)
        .sort(),
    ).toEqual(['f1', 'f2']);
  });
  it('searches evidence text and comments via recorded relationships', () => {
    const index = fixture([
      record('Comment', 'comment', {
        targetType: 'Finding',
        targetId: 'f1',
        body: 'Zebra Industries invoice approval missing',
      }),
    ]);
    expect(search('Show findings Zebra Industries', index).rows.map((r) => r.sourceId)).toEqual([
      'f1',
    ]);
    expect(
      search('Show evidence Supplier F', index)
        .rows.map((r) => r.sourceId)
        .sort(),
    ).toEqual(['doc1', 'ev1']);
  });
  it('enforces engagement scope across action and control paths, not only finding matches', () => {
    expect(
      search('Show open audit actions', fixture(), {
        searchScope: 'engagement',
        searchEngagementId: 'eng1',
      }).rows,
    ).toEqual([]);
    expect(
      search('Which controls have recurring weaknesses?', fixture(), {
        searchScope: 'engagement',
        searchEngagementId: 'eng1',
      }).rows,
    ).toEqual([]);
  });
  it('validates engagement selection and permissions', () => {
    expect(() => search('Show findings', fixture(), { searchScope: 'engagement' })).toThrow(
      BadRequestException,
    );
    const index = fixture();
    index.restrictedKinds = ['Engagement'];
    expect(() =>
      search('Show findings', index, { searchScope: 'engagement', searchEngagementId: 'eng1' }),
    ).toThrow(ForbiddenException);
  });
  it('never substitutes a different requested type when the scope excludes it', () => {
    expect(search('Show findings', fixture(), { searchKinds: ['Control'] }).rows).toEqual([]);
  });
  it('returns finding-level management actions without duplicating separate action plans', () => {
    const index = fixture([
      record('Finding', 'f3', {
        title: 'Another finding',
        engagementId: 'eng1',
        recommendation: 'Repair approval workflow',
        actionOwnerName: 'James',
        dueDate: '2026-09-15T00:00:00.000Z',
        status: 'AGREED',
      }),
    ]);
    const result = search('Show all open audit actions', index);
    expect(result.rows.map((r) => r.sourceId).sort()).toEqual(['a1', 'f3']);
    expect(result.rows.find((r) => r.sourceId === 'f3')?.detail).toContain(
      'Finding-level management action',
    );
  });
  it('does not report no-match for an empty page and counts beyond the old 80-record context limit', () => {
    const index = fixture(
      Array.from({ length: 105 }, (_, i) =>
        record('Finding', `bulk${i}`, {
          title: `Finding ${i}`,
          engagementId: 'eng1',
          status: 'CLOSED',
        }),
      ),
    );
    const first = search('Show findings', index);
    const second = search('Show findings', index, { searchPage: 2 });
    expect(first.totalMatches).toBe(107);
    expect(first.rows).toHaveLength(25);
    expect(second.rows.some((r) => first.rows.some((f) => f.sourceId === r.sourceId))).toBe(false);
    expect(search('Show findings', index, { searchPage: 100 }).emptyReason).toBeUndefined();
  });
  it.each(['no_data', 'permissions', 'incomplete', 'no_match'] as const)(
    'distinguishes %s without fabricated coverage',
    (reason) => {
      const index = fixture();
      if (reason !== 'no_match') {
        index.records = [];
        index.links = [];
      }
      if (reason === 'permissions') index.restrictedKinds = ['Finding'];
      if (reason === 'incomplete') index.incompleteKinds = ['Finding'];
      const result = search('Show findings nonexistenttransaction', index);
      expect(result.emptyReason).toBe(reason);
      expect(result.coveragePercent).toBe(reason === 'incomplete' ? null : 100);
    },
  );
  it('preserves source data and lowers confidence for incomplete coverage', () => {
    const index = fixture();
    index.incompleteKinds = ['Document'];
    const before = JSON.stringify(index);
    expect(search('Show findings', index).confidence).toBe('Low');
    expect(JSON.stringify(index)).toBe(before);
  });
  it('parses rolling 12 months without adding numeric keywords', () => {
    expect(
      interpretIntelligenceQuery(
        input('Show controls tested in the last 12 months with exceptions'),
        now,
      ),
    ).toMatchObject({ terms: [], from: '2025-09-08T12:00:00.000Z' });
  });
  it('retrieves workpaper-recorded exceptions without inventing separate control-test records', () => {
    const index = fixture([
      record('Control', 'c-wp', { title: 'Approval check' }),
      record('Workpaper', 'w-failed', {
        controlId: 'c-wp',
        engagementId: 'eng1',
        exceptions: 'Approver was not identified',
        preparedAt: '2026-03-03T00:00:00.000Z',
      }),
      record('Control', 'c-clean', { title: 'Clean test' }),
      record('Workpaper', 'w-clean', {
        controlId: 'c-clean',
        engagementId: 'eng1',
        exceptions: 'No exceptions identified.',
        preparedAt: '2026-03-03T00:00:00.000Z',
      }),
    ]);
    const result = search('Which controls failed testing in the last year?', index);
    expect(result.rows.map((r) => r.sourceId)).toContain('c-wp');
    expect(result.rows.map((r) => r.sourceId)).not.toContain('c-clean');
    expect(result.rows.find((r) => r.sourceId === 'c-wp')?.detail).toContain(
      '1 workpapers with recorded exceptions',
    );
  });
  it('includes remediation evidence and its original document in action traceability', () => {
    const index = fixture([
      record('Evidence', 'remediation', {
        description: 'Implementation proof',
        documentId: 'proof',
        engagementId: 'eng2',
        findings: [{ id: 'f2' }],
      }),
      record('Document', 'proof', {
        fileName: 'Approval-remediation.pdf',
        extractedText: 'Workflow revised',
      }),
    ]);
    expect(search('Show open audit actions', index).rows[0].traceIds).toEqual(
      expect.arrayContaining(['remediation', 'proof']),
    );
  });
  it('follows explicit finding-evidence support even when a finding lacks a workpaper foreign key', () => {
    const index = fixture([
      record('Finding', 'f-evidence', {
        title: 'Evidence-linked finding',
        engagementId: 'eng1',
        status: 'AGREED',
      }),
      record('Evidence', 'e-linked', {
        engagementId: 'eng1',
        workpaperId: 'wp1',
        findings: [{ id: 'f-evidence' }],
      }),
    ]);
    expect(search('Which risks have linked findings?', index).rows[0].traceIds).toContain(
      'f-evidence',
    );
  });
});

describe('Audit universe read-through indexing', () => {
  const user = { id: 'u', permissions: ['finding:read', 'ai:use'] } as AuthUser;
  it('reports a reached indexing limit instead of claiming an exhaustive scan', async () => {
    let page = 0;
    const fetch = jest.fn(async (kind: string) =>
      kind === 'Finding'
        ? Array.from({ length: 250 }, (_, i) => ({
            id: `f${page * 250 + i}`,
            title: 'Finding',
          })).map((r, i) => {
            if (i === 249) page++;
            return r;
          })
        : [],
    );
    const index = await new AuditUniverseIndexService({ fetch } as never, {} as never).build(user);
    expect(index.records).toHaveLength(5000);
    expect(index.incompleteKinds).toContain('Finding');
    expect(search('Show findings', index).coveragePercent).toBeNull();
  });
  it('pages all permitted records beyond 80 and retains tenant-scoped owner names', async () => {
    const fetch = jest.fn(async (kind: string, f: { afterId?: string }) =>
      kind === 'Finding'
        ? Array.from({ length: f.afterId ? 20 : 250 }, (_, i) => ({
            id: `${f.afterId ? 'b' : 'a'}${i}`,
            title: 'Finding',
            actionOwnerId: 'owner',
          }))
        : [],
    );
    const findMany = jest
      .fn()
      .mockResolvedValue([{ id: 'owner', displayName: 'Susan Finance Manager' }]);
    const service = new AuditUniverseIndexService(
      { fetch } as never,
      { scoped: () => ({ user: { findMany } }) } as never,
    );
    const index = await service.build(user);
    expect(index.records).toHaveLength(270);
    expect(index.records[0].fields.ownerName).toBe('Susan Finance Manager');
    expect(fetch.mock.calls.filter(([k]) => k === 'Finding')).toHaveLength(2);
    expect(fetch.mock.calls.some(([k]) => k === 'Document')).toBe(false);
    expect(findMany).toHaveBeenCalledWith({
      where: { id: { in: ['owner'] }, deletedAt: null },
      select: { id: true, displayName: true },
    });
  });
  it('retains partial results and reports incomplete indexing on a read failure', async () => {
    const fetch = jest.fn(async (kind: string) => {
      if (kind === 'Finding') throw new Error('private database diagnostics');
      return [];
    });
    const index = await new AuditUniverseIndexService({ fetch } as never, {} as never).build(user);
    expect(index.incompleteKinds).toContain('Finding');
    expect(JSON.stringify(index)).not.toContain('private database diagnostics');
  });
  it('reports a total retrieval failure as an error, not no matching records', async () => {
    const fetch = jest.fn().mockRejectedValue(new Error('offline'));
    await expect(
      new AuditUniverseIndexService({ fetch } as never, {} as never).build(user),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
  it('discards orphan and inaccessible-parent comments and marks missing document text', async () => {
    const fetch = jest.fn(async (kind: string) =>
      kind === 'Comment'
        ? [{ id: 'c', targetType: 'Finding', targetId: 'missing', body: 'Hidden' }]
        : kind === 'Document'
          ? [{ id: 'd', fileName: 'Scan.pdf', extractedText: null }]
          : [],
    );
    const index = await new AuditUniverseIndexService({ fetch } as never, {} as never).build({
      ...user,
      permissions: [...user.permissions, 'document:read'],
    });
    expect(index.records.map((r) => r.source.kind)).toEqual(['Document']);
    expect(index.textLimitedRecords).toBe(1);
  });
});
