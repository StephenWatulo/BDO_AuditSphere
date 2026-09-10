import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  AUDIT_SEARCH_KINDS,
  type AssistantContent,
  type AuditSearchKind,
  type AuditSearchSummary,
} from '@auditsphere/shared';
import { CopilotRequestDto } from './ai.dto';
import { AuditContext, AuditRecord, field } from './audit-context.types';
import { AuditUniverseIndex } from './audit-universe-index.service';

const normal = (value: string) =>
  value
    .toLowerCase()
    .replace(/[_-]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const CONCEPTS: Record<string, string[]> = {
  procurement: [
    'procurement',
    'purchasing',
    'purchase',
    'purchase order',
    'accounts payable',
    'supplier',
    'vendor',
    'procure to pay',
  ],
  approval: [
    'approval',
    'approve',
    'approver',
    'authorisation',
    'authorization',
    'authority',
    'delegation',
    'sign off',
  ],
  weakness: [
    'weakness',
    'weaknesses',
    'failure',
    'failed',
    'exception',
    'exceptions',
    'missing',
    'incomplete',
    'ineffective',
    'deficient',
    'not verified',
    'could not be confirmed',
  ],
};
const STOP = new Set(
  'show me all any the a an which what who where when how many list find retrieve search give tell about of for with without in on at by from to and or have has had having are is was were be been being do does did can please across related relating identified recorded linked links link their there that those these this as it its my audit audits auditing universe record records engagement engagements entity entities process processes risk risks control controls workpaper workpapers evidence document documents finding findings issue issues action actions plan plans management owner owners due date dates status result results test tests tested testing last past previous year years month months completed complete closed open unresolved overdue recurring repeated recurrent repeat high medium low critical risk rated rating ineffective failed exceptions exception weaknesses weakness obtained identified suppliers analysed analyzed intelligence'.split(
    ' ',
  ),
);
const TYPE_WORDS: [AuditSearchKind, RegExp][] = [
  ['ActionPlan', /\b(?:actions?|action plans?|remediation)\b/],
  ['Finding', /\bfindings?\b/],
  ['Risk', /\brisks?\b/],
  ['Control', /\bcontrols?\b/],
  ['Workpaper', /\bworkpapers?\b/],
  ['Evidence', /\b(?:evidence|documents?)\b/],
  ['Engagement', /\bengagements?\b/],
  ['Process', /\bprocess(?:es)?\b/],
  ['Entity', /\bentit(?:y|ies)\b/],
];
const terminalFinding = (r: AuditRecord) =>
  ['CLOSED', 'RISK_ACCEPTED'].includes(field(r, 'status'));
const terminalAction = (r: AuditRecord) =>
  r.source.kind === 'Finding'
    ? terminalFinding(r)
    : ['VALIDATED', 'SUPERSEDED'].includes(field(r, 'status'));
const failedTest = (r: AuditRecord) =>
  Number(r.fields.exceptions) > 0 ||
  ['FAIL', 'PASS_WITH_EXCEPTIONS', 'FAILED', 'INEFFECTIVE', 'PARTIALLY_EFFECTIVE'].includes(
    field(r, 'result'),
  );
const failedControl = (r: AuditRecord) =>
  field(r, 'effectiveness') === 'INEFFECTIVE' ||
  r.fields.designEffective === false ||
  r.fields.operatingEffective === false;
const workpaperException = (r: AuditRecord) =>
  !!field(r, 'exceptions') &&
  !/^(?:0\b|none\b|nil\b|n\/a\b|no\s+exceptions?\b)/i.test(field(r, 'exceptions'));
const workpaperDate = (r: AuditRecord) => field(r, 'preparedAt') || field(r, 'updatedAt');

export function interpretIntelligenceQuery(dto: CopilotRequestDto, now = new Date()) {
  const q = normal(dto.prompt);
  const withoutExceptions = /\b(?:without|no)\s+(?:recorded\s+)?exceptions?\b/.test(q);
  const withoutFindings = /\b(?:without|no)\s+(?:linked\s+)?findings?\b/.test(q);
  if (/\b(?:not|without|excluding|except|no)\b/.test(q) && !withoutExceptions && !withoutFindings) {
    throw new BadRequestException(
      'This negative query cannot be interpreted reliably. Use explicit positive filters, or ask for records without linked findings or without exceptions.',
    );
  }
  const completed =
    /\b(?:completed|closed) (?:audits|engagements)\b|\b(?:audits|engagements) (?:that are )?completed\b/.test(
      q,
    );
  // The first requested object is the answer type; later objects describe relationships.
  const subject = q.replace(/\b(high|medium|low|critical) risk\b/g, '$1');
  const mentions = TYPE_WORDS.map(([kind, regex]) => ({ kind, at: subject.search(regex) }))
    .filter((v) => v.at >= 0)
    .sort((a, b) => a.at - b.at);
  const inferred = mentions[0]?.kind ?? (/\baudits?\b/.test(q) ? 'Engagement' : undefined);
  const allowed = dto.searchKinds ?? [...AUDIT_SEARCH_KINDS];
  const kinds = inferred ? allowed.filter((k) => k === inferred) : allowed;
  const concepts = Object.entries(CONCEPTS)
    .filter(([, aliases]) => aliases.some((a) => new RegExp(`\\b${a}\\b`).test(q)))
    .map(([name]) => name);
  const aliases = new Set(concepts.flatMap((c) => CONCEPTS[c].flatMap((a) => a.split(' '))));
  const terms = [
    ...new Set(
      q
        .split(' ')
        .filter(
          (t) =>
            t.length > 1 &&
            !STOP.has(t) &&
            !((withoutExceptions || withoutFindings) && t === 'no') &&
            !aliases.has(t) &&
            !(/^12$/.test(t) && /12 months/.test(q)) &&
            !/^20\d\d$/.test(t),
        ),
    ),
  ];
  const year = q.match(/\b(20\d{2})\b/);
  let from: string | undefined;
  let to: string | undefined;
  if (/\b(?:last|past|previous) (?:year|12 months)\b/.test(q)) {
    const start = new Date(now);
    start.setUTCFullYear(start.getUTCFullYear() - 1);
    from = start.toISOString();
    to = now.toISOString();
  } else if (/\bthis month\b/.test(q)) {
    from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
  } else if (year && !/\b(?:ia|risk|ctrl)\s+20\d\d\b/.test(q)) {
    from = `${year[1]}-01-01T00:00:00.000Z`;
    to = `${Number(year[1]) + 1}-01-01T00:00:00.000Z`;
  }
  return {
    q,
    kinds,
    concepts,
    terms,
    from,
    to,
    completed,
    closed: /\bclosed\b/.test(q) && !completed,
    withoutExceptions,
    withoutFindings,
    open: /\b(?:open|unresolved)\b/.test(q),
    overdue: /\boverdue\b/.test(q),
    recurring: /\b(?:recurring|repeated|recurrent|repeat)\b/.test(q),
    linkedFindings: !withoutFindings && /\b(?:linked|with|have) (?:\w+ )?findings\b/.test(q),
    failed: !withoutExceptions && /\b(?:ineffective|failed|failures|exceptions)\b/.test(q),
    severity: /\bhigh(?: risk)?\b/.test(q)
      ? 'HIGH'
      : /\bcritical\b/.test(q)
        ? 'CRITICAL'
        : /\bmedium\b/.test(q)
          ? 'MEDIUM'
          : /\blow\b/.test(q)
            ? 'LOW'
            : undefined,
  };
}

export function searchAuditIntelligence(
  dto: CopilotRequestDto,
  index: AuditUniverseIndex,
  now = new Date(),
): { context: AuditContext; draft: AssistantContent } {
  const query = interpretIntelligenceQuery(dto, now);
  const byId = new Map(index.records.map((r) => [r.source.id, r]));
  const parents = new Map<string, AuditRecord[]>();
  const children = new Map<string, AuditRecord[]>();
  for (const link of index.links) {
    const a = byId.get(link.from);
    const b = byId.get(link.to);
    if (!a || !b || link.relationship === 'repeatOf') continue;
    parents.set(b.source.id, [...(parents.get(b.source.id) ?? []), a]);
    children.set(a.source.id, [...(children.get(a.source.id) ?? []), b]);
    if (
      link.relationship === 'supported by' &&
      a.source.kind === 'Finding' &&
      b.source.kind === 'Evidence'
    )
      children.set(b.source.id, [...(children.get(b.source.id) ?? []), a]);
  }
  const walk = (root: AuditRecord, direction: Map<string, AuditRecord[]>, down = false) => {
    const found = new Map<string, AuditRecord>([[root.source.id, root]]);
    const queue = [root];
    for (let i = 0; i < queue.length; i++)
      for (const next of direction.get(queue[i].source.id) ?? []) {
        if (
          found.has(next.source.id) ||
          (down && ['Entity', 'Process', 'Engagement'].includes(next.source.kind))
        )
          continue;
        found.set(next.source.id, next);
        queue.push(next);
      }
    return [...found.values()];
  };
  const ancestorCache = new Map<string, AuditRecord[]>();
  const ancestors = (r: AuditRecord) => {
    if (!ancestorCache.has(r.source.id)) ancestorCache.set(r.source.id, walk(r, parents));
    return ancestorCache.get(r.source.id)!;
  };
  const engagementIds = (r: AuditRecord) =>
    new Set(
      ancestors(r)
        .filter((p) => p.source.kind === 'Engagement')
        .map((p) => p.source.recordId),
    );
  const scopeId =
    dto.searchScope === 'engagement'
      ? (dto.searchEngagementId ?? (dto.targetType === 'Engagement' ? dto.targetId : undefined))
      : undefined;
  if (dto.searchScope === 'engagement') {
    if (!scopeId)
      throw new BadRequestException('Choose an engagement for current-engagement search.');
    if (index.restrictedKinds.includes('Engagement'))
      throw new ForbiddenException('Engagement read permission is required for this scope.');
    if (!index.records.some((r) => r.source.kind === 'Engagement' && r.source.recordId === scopeId))
      throw new NotFoundException('Selected engagement is unavailable or was not indexed.');
  }
  const inScope = (r: AuditRecord) => !scopeId || engagementIds(r).has(scopeId);
  const insideDate = (date: string) =>
    !!date && (!query.from || (date >= query.from && date < query.to!));
  const today = now.toISOString().slice(0, 10);
  const overdue = (r: AuditRecord) =>
    !!field(r, 'dueDate') && field(r, 'dueDate').slice(0, 10) < today && !terminalAction(r);
  const actionParents = new Set(
    index.records.filter((r) => r.source.kind === 'ActionPlan').map((r) => field(r, 'findingId')),
  );
  const resultKind = (r: AuditRecord): AuditSearchKind | undefined => {
    if (r.source.kind === 'Document') return 'Evidence';
    if (
      query.kinds.length === 1 &&
      query.kinds[0] === 'ActionPlan' &&
      r.source.kind === 'Finding' &&
      !actionParents.has(r.source.recordId) &&
      (field(r, 'recommendation') || field(r, 'managementResponse')) &&
      (field(r, 'actionOwnerId') || field(r, 'actionOwnerName') || field(r, 'dueDate'))
    )
      return 'ActionPlan';
    return (AUDIT_SEARCH_KINDS as readonly string[]).includes(r.source.kind)
      ? (r.source.kind as AuditSearchKind)
      : undefined;
  };
  const matches: {
    record: AuditRecord;
    kind: AuditSearchKind;
    related: AuditRecord[];
    reason: string;
    score: number;
    engagements: AuditRecord[];
  }[] = [];
  for (const r of index.records) {
    const kind = resultKind(r);
    if (!kind || !query.kinds.includes(kind)) continue;
    const descendants = walk(r, children, true);
    const scopedChildren = descendants.filter(inScope);
    if (scopeId && !inScope(r) && !scopedChildren.length) continue;
    const outcomes = scopeId ? scopedChildren : descendants;
    const findings = outcomes.filter((x) => x.source.kind === 'Finding');
    const tests = outcomes.filter((x) => x.source.kind === 'ControlTest');
    const workpapers = outcomes.filter((x) => x.source.kind === 'Workpaper');
    const controls = outcomes.filter((x) => x.source.kind === 'Control');
    const actions = outcomes.filter((x) => x.source.kind === 'ActionPlan');
    const actionEvidence =
      kind === 'ActionPlan'
        ? ancestors(r)
            .filter((p) => p.source.kind === 'Finding')
            .flatMap((p) => walk(p, children, true))
            .filter((p) => ['Evidence', 'Document'].includes(p.source.kind) && inScope(p))
        : [];
    const related = [
      ...new Map(
        [
          ...ancestors(r),
          ...outcomes,
          ...outcomes.flatMap(ancestors),
          ...actionEvidence,
          ...actionEvidence.flatMap(ancestors),
        ].map((x) => [x.source.id, x]),
      ).values(),
    ];
    const engagements = related.filter(
      (x) => x.source.kind === 'Engagement' && (!scopeId || x.source.recordId === scopeId),
    );
    if (query.completed && !engagements.some((e) => field(e, 'status') === 'COMPLETED')) continue;
    if (
      query.severity &&
      field(
        r,
        kind === 'Risk'
          ? 'rating'
          : kind === 'ActionPlan' && r.source.kind === 'ActionPlan'
            ? 'priority'
            : 'severity',
      ) !== query.severity
    )
      continue;
    if (query.linkedFindings && !findings.length) continue;
    if (query.withoutFindings && findings.length) continue;
    if (
      query.closed &&
      field(r, 'status') !==
        (kind === 'Engagement'
          ? 'COMPLETED'
          : r.source.kind === 'ActionPlan'
            ? 'VALIDATED'
            : 'CLOSED')
    )
      continue;
    if (query.withoutExceptions) {
      const periodTests = tests.filter((t) => !query.from || insideDate(field(t, 'testedAt')));
      const periodWorkpapers = workpapers.filter(
        (w) => !query.from || insideDate(workpaperDate(w)),
      );
      const recordedClean =
        periodTests.some(
          (t) => field(t, 'result') === 'PASS' && Number(t.fields.exceptions) === 0,
        ) ||
        periodWorkpapers.some((w) =>
          /^(?:0\b|none\b|nil\b|no\s+exceptions?\b)/i.test(field(w, 'exceptions')),
        );
      if (
        !recordedClean ||
        periodTests.some(failedTest) ||
        periodWorkpapers.some(workpaperException)
      )
        continue;
    }
    if (
      query.recurring &&
      (kind === 'Control' || kind === 'Risk') &&
      findings.length < 2 &&
      !findings.some((f) => f.fields.isRepeat === true)
    )
      continue;
    if (
      query.recurring &&
      kind === 'Finding' &&
      r.fields.isRepeat !== true &&
      !field(r, 'repeatOfId')
    )
      continue;
    if (
      query.open &&
      (kind === 'Risk' || kind === 'Control'
        ? !findings.some((f) => !terminalFinding(f)) &&
          !actions.some(overdue) &&
          !controls.some(failedControl) &&
          !tests.some(failedTest) &&
          !workpapers.some(workpaperException)
        : kind === 'ActionPlan'
          ? terminalAction(r)
          : kind === 'Finding'
            ? terminalFinding(r)
            : ['CLOSED', 'COMPLETED', 'CANCELLED'].includes(field(r, 'status')))
    )
      continue;
    if (
      query.overdue &&
      (kind === 'Risk' || kind === 'Control'
        ? !findings.some(overdue) && !actions.some(overdue)
        : !overdue(r))
    )
      continue;
    if (
      query.failed &&
      (kind === 'Control' || kind === 'Risk') &&
      !(
        tests.some((t) => failedTest(t) && (!query.from || insideDate(field(t, 'testedAt')))) ||
        workpapers.some(
          (w) => workpaperException(w) && (!query.from || insideDate(workpaperDate(w))),
        ) ||
        (!query.from && controls.some(failedControl))
      )
    )
      continue;
    if (query.from) {
      if (kind === 'Control' || kind === 'Risk') {
        if (
          !tests.some(
            (t) => insideDate(field(t, 'testedAt')) && (!query.failed || failedTest(t)),
          ) &&
          !workpapers.some(
            (w) => insideDate(workpaperDate(w)) && (!query.failed || workpaperException(w)),
          )
        )
          continue;
      } else if (
        !insideDate(
          field(
            r,
            kind === 'ActionPlan' || /\bdue\b/.test(query.q)
              ? 'dueDate'
              : kind === 'Evidence'
                ? r.source.kind === 'Document'
                  ? 'uploadedAt'
                  : 'obtainedAt'
                : kind === 'Engagement'
                  ? 'actualEnd'
                  : kind === 'Workpaper'
                    ? 'updatedAt'
                    : 'createdAt',
          ),
        )
      )
        continue;
    }
    const searchable = related.map((x) => normal(JSON.stringify(x.fields))).join(' ');
    // Organisation-wide objectives are not evidence that every child finding concerns that topic.
    const hasProcess = related.some((x) => x.source.kind === 'Process');
    const semanticText = related.map((x) => {
      if (x.source.kind === 'Entity' && kind !== 'Entity') return normal(`${field(x, 'name')} ${field(x, 'code')}`);
      if (x.source.kind === 'Engagement' && kind !== 'Engagement' && hasProcess) return normal(field(x, 'auditNumber'));
      return normal(JSON.stringify(x.fields));
    }).join(' ');
    const ownText = normal(JSON.stringify(r.fields));
    if (
      !query.concepts.every(
        (c) =>
          (c === 'weakness' &&
            ((query.failed && ['Control', 'Risk'].includes(kind)) ||
              query.recurring ||
              query.withoutExceptions)) ||
          CONCEPTS[c].some((alias) => semanticText.includes(alias)),
      )
    )
      continue;
    if (!query.terms.every((term) => searchable.includes(term))) continue;
    const qualifyingTests = tests.filter(
      (t) => failedTest(t) && (!query.from || insideDate(field(t, 'testedAt'))),
    );
    const qualifyingWorkpapers = workpapers.filter(
      (w) => workpaperException(w) && (!query.from || insideDate(workpaperDate(w))),
    );
    const reason = [
      query.concepts.length
        ? `Audit concepts: ${query.concepts.join(', ')}`
        : 'Recorded attributes and relationships',
      query.linkedFindings ? `${findings.length} linked findings` : '',
      query.withoutFindings
        ? 'No findings linked in the accessible index; coverage limitations still apply'
        : '',
      query.withoutExceptions
        ? 'Explicitly recorded clean testing; no exceptions found in the qualifying indexed tests. This is not a control-effectiveness opinion.'
        : '',
      query.recurring
        ? `${findings.length} linked findings; repeat flags preserved (common cause requires validation)`
        : '',
      query.failed
        ? `${qualifyingTests.length} qualifying control tests with exceptions/failure; ${qualifyingWorkpapers.length} workpapers with recorded exceptions (date basis: prepared date, otherwise updated date). Control effectiveness: ${controls.map((c) => field(c, 'effectiveness')).join(', ') || 'not recorded'}`
        : '',
      query.open ? 'Unresolved recorded status or linked issue' : '',
      query.completed ? 'Linked completed engagement' : '',
    ]
      .filter(Boolean)
      .join('. ');
    matches.push({
      record: r,
      kind,
      related,
      reason,
      engagements,
      score:
        query.terms.filter((t) => ownText.includes(t)).length * 2 +
        query.concepts.filter((c) => CONCEPTS[c].some((a) => ownText.includes(a))).length,
    });
  }
  matches.sort(
    (a, b) =>
      b.score - a.score ||
      a.record.source.label.localeCompare(b.record.source.label) ||
      a.record.source.recordId.localeCompare(b.record.source.recordId),
  );
  const pageSize = 25;
  const page = dto.searchPage ?? 1;
  const selected = matches.slice((page - 1) * pageSize, page * pageSize);
  const included = new Map(selected.map((m) => [m.record.source.id, m.record]));
  for (const m of selected)
    for (const r of m.related) if (included.size < 400) included.set(r.source.id, r);
  const warnings = [...index.warnings];
  if (selected.some((m) => m.related.some((r) => !included.has(r.source.id))))
    warnings.push(
      'Displayed traceability is limited to 400 sources. Result counts reflect the full indexed match set.',
    );
  const counts: Partial<Record<AuditSearchKind, number>> = {};
  matches.forEach((m) => {
    counts[m.kind] = (counts[m.kind] ?? 0) + 1;
  });
  const coverageLimited = index.incompleteKinds.length > 0;
  const lowConfidence =
    coverageLimited ||
    index.restrictedKinds.length > 0 ||
    index.textLimitedRecords > 0 ||
    index.warnings.length > 0;
  const intelligence: NonNullable<AuditSearchSummary['intelligence']> = {
    indexedAt: index.indexedAt,
    coveragePercent: coverageLimited ? null : 100,
    coverageBasis:
      'Accessible record metadata scanned in this request, not the percentage of hidden records or full document content. Private/restricted documents remain permission-filtered. This is a live read-through index, not a transactionally frozen snapshot.',
    sourcesAnalysed: index.records.length,
    restrictedKinds: index.restrictedKinds,
    incompleteKinds: index.incompleteKinds,
    textLimitedRecords: index.textLimitedRecords,
    confidence:
      !matches.length || coverageLimited
        ? 'Low'
        : lowConfidence || query.concepts.length > 0 || query.terms.length > 0
          ? 'Medium'
          : 'High',
    confidenceReason:
      'Retrieval confidence, not an audit opinion or statistical assurance. Explicit database links and filters are facts; terminology expansion and repeat-weakness classification require auditor validation.',
    totalMatches: matches.length,
    engagementCount: new Set(matches.flatMap((m) => m.engagements.map((e) => e.source.recordId)))
      .size,
    counts,
    page,
    pageSize,
    emptyReason: matches.length
      ? undefined
      : coverageLimited
        ? 'incomplete'
        : index.restrictedKinds.some((k) => query.kinds.includes(k as AuditSearchKind))
          ? 'permissions'
          : index.records.some((r) => query.kinds.includes(resultKind(r)!))
            ? 'no_match'
            : 'no_data',
    rows: selected.map((m) => ({
      sourceId: m.record.source.id,
      kind: m.kind,
      engagement:
        m.engagements.map((e) => field(e, 'auditNumber')).join(', ') || 'Not linked / not visible',
      severity:
        field(m.record, 'severity') ||
        field(m.record, 'rating') ||
        field(m.record, 'priority') ||
        'Not recorded',
      owner: field(m.record, 'ownerName') || field(m.record, 'actionOwnerName') || 'Not assigned',
      status: field(m.record, 'status') || field(m.record, 'effectiveness') || 'Not recorded',
      dueDate: field(m.record, 'dueDate'),
      detail: [
        m.reason,
        m.kind === 'ActionPlan'
          ? m.record.source.kind === 'Finding'
            ? 'Finding-level management action; no separate action plan recorded.'
            : `Progress: ${field(m.record, 'progressPct')}%. ${field(m.record, 'progressNote')}. Parent finding validation is shown in traceability, not assumed to validate this action.`
          : '',
        m.kind === 'Control'
          ? `Effectiveness: ${field(m.record, 'effectiveness') || 'Not tested'}`
          : '',
      ]
        .filter(Boolean)
        .join(' '),
      traceIds: m.related
        .filter((r) => r !== m.record && included.has(r.source.id))
        .slice(0, 60)
        .map((r) => r.source.id),
    })),
    query: {
      prompt: dto.prompt,
      searchScope: dto.searchScope ?? 'universe',
      searchEngagementId: scopeId,
      searchKinds: dto.searchKinds,
      searchPage: page,
    },
  };
  const summary = `${matches.length} matching records across ${intelligence.engagementCount} linked engagements. ${Object.entries(
    counts,
  )
    .map(([k, n]) => `${k}: ${n}`)
    .join('; ')}.`;
  const filters = [
    query.completed && 'completed engagements',
    query.closed && 'closed / validated status',
    query.open && 'unresolved status',
    query.overdue && 'overdue',
    query.severity && `severity/rating ${query.severity}`,
    query.linkedFindings && 'linked findings',
    query.withoutFindings && 'no linked findings',
    query.failed && 'recorded test exceptions/failure',
    query.recurring && 'repeated findings',
    query.withoutExceptions && 'recorded testing without exceptions',
  ].filter(Boolean);
  const interpretation = `Audit-domain terminology expansion and explicit relationship retrieval. Scope: ${scopeId ? 'selected engagement' : 'all accessible audit universe'}. Types: ${query.kinds.join(', ') || 'none within selected filters'}. Filters: ${filters.join(', ') || 'none'}. Concepts: ${query.concepts.join(', ') || 'none'}. Additional terms: ${query.terms.join(', ') || 'none'}. Open actions include implemented actions pending validation; risk-accepted findings and superseded actions are not open. ${query.from ? `Dates: ${query.from} to ${query.to} (exclusive). Controls/risks use the qualifying test date or workpaper prepared/updated date; actions use due date. Last year is rolling 12 months.` : ''}`;
  const context: AuditContext = {
    records: [...included.values()].map((r) => ({
      ...r,
      fields: Object.fromEntries(
        Object.entries(r.fields).map(([k, v]) => [k, typeof v === 'string' ? v.slice(0, 6000) : v]),
      ),
    })),
    links: index.links.filter((l) => included.has(l.from) && included.has(l.to)),
    warnings,
    search: {
      interpretation,
      terms: [...query.concepts, ...query.terms],
      from: query.from,
      to: query.to,
      exceptionsOnly: query.failed,
      results: selected.map((m) => ({ sourceId: m.record.source.id, reason: m.reason })),
      intelligence,
    },
  };
  const draft: AssistantContent = {
    title: 'Audit Intelligence',
    narrative: matches.length ? summary : 'No matching records found.',
    sections: [
      {
        title: 'Search Summary',
        columns: [],
        rows: [],
        items: [
          { text: interpretation, basis: 'assessment', sourceIds: [] },
          ...(!matches.length
            ? [
                {
                  text: `Observed result: ${intelligence.emptyReason}. Possible reasons: no indexed records exist in scope; terms need refinement; permissions restrict visibility; indexing is incomplete. A no-match result is not evidence of absence.`,
                  basis: 'missing' as const,
                  sourceIds: [],
                },
              ]
            : []),
        ],
      },
      {
        title: 'Results',
        items: [],
        columns: [
          'Record',
          'Engagement',
          'Severity / rating',
          'Owner',
          'Status',
          'Due date',
          'Audit intelligence',
        ],
        rows: intelligence.rows.map((r) => ({
          cells: [
            byId.get(r.sourceId)!.source.label,
            r.engagement,
            r.severity,
            r.owner,
            r.status,
            r.dueDate.slice(0, 10) || 'Not set',
            r.detail,
          ].map((s) => s.slice(0, 4000)),
          basis: 'assessment',
          sourceIds: [r.sourceId, ...r.traceIds].slice(0, 100),
        })),
      },
      {
        title: 'Coverage',
        columns: [],
        rows: [],
        items: [
          {
            text: `${intelligence.sourcesAnalysed} accessible records analysed; metadata coverage: ${intelligence.coveragePercent ?? 'unknown'}${intelligence.coveragePercent === null ? '' : '%'}. Confidence: ${intelligence.confidence}. ${intelligence.coverageBasis} ${intelligence.confidenceReason}`,
            basis: 'assessment',
            sourceIds: [],
          },
        ],
      },
    ],
    exceptions: [],
    reviewerNotes: [],
    evidenceAssessment: {
      status: 'NOT_ASSESSED',
      rationale: 'Retrieval does not assess evidence sufficiency.',
      sourceIds: [],
      checks: [],
    },
    ratingProposal: {
      impact: null,
      likelihood: null,
      score: null,
      rating: 'UNRATED',
      rationale: 'Search never changes or proposes record ratings.',
      sourceIds: [],
    },
    suggestions: [],
    checklist: [
      'Validate cited records, relationship paths and query interpretation before inclusion in audit documentation.',
    ],
    caveats: [
      ...warnings,
      'Search uses an audit-domain synonym dictionary, not a general-purpose embedding model. Unrecognised terms can require refinement.',
      'Repeated linked findings are review candidates, not proof of a common root cause. No records were created, approved, closed, issued or re-rated by this search.',
    ],
  };
  return { context, draft };
}
