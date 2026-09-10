import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import type { AuditSourceKind } from '@auditsphere/shared';
import { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditContextService, AUDIT_READ_PERMISSION, href } from './audit-context.service';
import { AuditContext, AuditRecord, field } from './audit-context.types';

export const INDEX_KINDS: AuditSourceKind[] = [
  'Entity',
  'Process',
  'Engagement',
  'Risk',
  'Control',
  'Procedure',
  'Workpaper',
  'Finding',
  'ActionPlan',
  'Evidence',
  'ControlTest',
  'ReviewNote',
  'Document',
  'Comment',
];
export interface AuditUniverseIndex extends AuditContext {
  indexedAt: string;
  restrictedKinds: string[];
  incompleteKinds: string[];
  textLimitedRecords: number;
}
const PARENTS: [string, AuditSourceKind][] = [
  ['parentId', 'Entity'],
  ['entityId', 'Entity'],
  ['processId', 'Process'],
  ['riskId', 'Risk'],
  ['controlId', 'Control'],
  ['engagementId', 'Engagement'],
  ['programStepId', 'Procedure'],
  ['workpaperId', 'Workpaper'],
  ['documentId', 'Document'],
  ['findingId', 'Finding'],
  ['repeatOfId', 'Finding'],
];

export function linkAuditRecords(records: AuditRecord[]): AuditContext['links'] {
  const byKey = new Map(records.map((r) => [`${r.source.kind}:${r.source.recordId}`, r]));
  const links = new Map<string, AuditContext['links'][number]>();
  const link = (a: AuditRecord | undefined, b: AuditRecord, relationship: string) => {
    if (a && a !== b)
      links.set(`${a.source.id}:${b.source.id}:${relationship}`, {
        from: a.source.id,
        to: b.source.id,
        relationship,
      });
  };
  for (const r of records) {
    for (const [key, kind] of PARENTS)
      link(byKey.get(`${kind}:${field(r, key)}`), r, key.replace(/Id$/, ''));
    if (r.source.kind === 'Control')
      for (const risk of (r.fields.risks ?? []) as { riskId: string }[])
        link(byKey.get(`Risk:${risk.riskId}`), r, 'mitigated by');
    if (r.source.kind === 'Evidence')
      for (const finding of (r.fields.findings ?? []) as { id: string }[])
        link(byKey.get(`Finding:${finding.id}`), r, 'supported by');
    if (r.source.kind === 'Comment')
      link(byKey.get(`${field(r, 'targetType')}:${field(r, 'targetId')}`), r, 'comment');
    if (r.source.kind === 'Document')
      link(byKey.get(`${field(r, 'ownerType')}:${field(r, 'ownerId')}`), r, 'attachment');
  }
  return [...links.values()];
}

@Injectable()
export class AuditUniverseIndexService {
  private readonly logger = new Logger(AuditUniverseIndexService.name);
  constructor(
    private readonly reader: AuditContextService,
    private readonly prisma: PrismaService,
  ) {}

  // Read-through indexing deliberately avoids a stale cache of permissions or document visibility.
  async build(user: AuthUser): Promise<AuditUniverseIndex> {
    const index: AuditUniverseIndex = {
      records: [],
      links: [],
      warnings: [],
      indexedAt: new Date().toISOString(),
      restrictedKinds: [],
      incompleteKinds: [],
      textLimitedRecords: 0,
    };
    let characters = 0;
    let successfulReads = 0;
    for (const kind of INDEX_KINDS) {
      if (!user.permissions.includes(AUDIT_READ_PERMISSION[kind])) {
        index.restrictedKinds.push(kind);
        continue;
      }
      let afterId: string | undefined;
      let count = 0;
      try {
        while (true) {
          const rows = await this.reader.fetch(kind, { index: true, afterId, take: 250 }, user);
          successfulReads++;
          for (const raw of rows) {
            if (count >= 5000 || index.records.length >= 20000 || characters >= 25000000) {
              index.incompleteKinds.push(kind);
              break;
            }
            const fields = JSON.parse(JSON.stringify(raw)) as Record<string, unknown>;
            let limited =
              Array.isArray(fields.tags) && fields.tags.includes('ai-context:truncated');
            for (const [key, value] of Object.entries(fields))
              if (typeof value === 'string' && value.length > 60000) {
                fields[key] = value.slice(0, 60000);
                limited = true;
              }
            if (kind === 'Document' && !field({ fields } as AuditRecord, 'extractedText'))
              limited = true;
            if (limited) index.textLimitedRecords++;
            const text = JSON.stringify(fields);
            characters += text.length;
            index.records.push({
              fields,
              source: {
                id: `S${index.records.length + 1}`,
                kind,
                recordId: String(fields.id),
                label: [
                  fields.auditNumber ??
                    fields.reference ??
                    fields.code ??
                    (kind === 'ActionPlan' ? `Action ${fields.sequence}` : ''),
                  fields.title ??
                    fields.name ??
                    fields.fileName ??
                    fields.description ??
                    fields.objective ??
                    fields.text ??
                    kind,
                ]
                  .filter(Boolean)
                  .join(' - ')
                  .slice(0, 300),
                href: href(kind, fields),
                excerpt: text.slice(0, 3000),
                truncated: limited || text.length > 3000,
              },
            });
            count++;
          }
          if (index.incompleteKinds.includes(kind) || rows.length < 250) break;
          const nextId = String(rows.at(-1)!.id);
          if (nextId === afterId) throw new Error('Index cursor did not advance');
          afterId = nextId;
        }
      } catch {
        if (!index.incompleteKinds.includes(kind)) index.incompleteKinds.push(kind);
        this.logger.warn(`Audit intelligence indexing incomplete for ${kind}`);
      }
    }
    if (!successfulReads && index.incompleteKinds.length)
      throw new ServiceUnavailableException(
        'Audit search failed while reading the index. Retry or contact an administrator; this is not a no-match result.',
      );
    const keys = new Set(index.records.map((r) => `${r.source.kind}:${r.source.recordId}`));
    index.records = index.records.filter(
      (r) =>
        r.source.kind !== 'Comment' ||
        keys.has(`${field(r, 'targetType')}:${field(r, 'targetId')}`),
    );
    const ownerIds = new Set<string>();
    for (const r of index.records) {
      for (const key of [
        'ownerId',
        'actionOwnerId',
        'leadId',
        'managerId',
        'partnerId',
        'preparedById',
        'reviewedById',
      ])
        if (field(r, key)) ownerIds.add(field(r, key));
      for (const m of (r.fields.members ?? []) as { userId: string }[]) ownerIds.add(m.userId);
    }
    try {
      const names = new Map<string, string>();
      const ids = [...ownerIds];
      for (let i = 0; i < ids.length; i += 250) {
        const users = await this.prisma
          .scoped()
          .user.findMany({
            where: { id: { in: ids.slice(i, i + 250) }, deletedAt: null },
            select: { id: true, displayName: true },
          });
        users.forEach((u) => names.set(u.id, u.displayName));
      }
      for (const r of index.records) {
        r.fields.ownerName =
          names.get(field(r, 'ownerId') || field(r, 'actionOwnerId')) ??
          (field(r, 'ownerId') || field(r, 'actionOwnerId')
            ? 'Assigned user unavailable'
            : field(r, 'ownerName') || field(r, 'actionOwnerName'));
        if (r.source.kind === 'Engagement')
          r.fields.team = [
            ...new Set(
              [
                field(r, 'leadId'),
                field(r, 'managerId'),
                field(r, 'partnerId'),
                ...((r.fields.members ?? []) as { userId: string }[]).map((m) => m.userId),
              ].filter(Boolean),
            ),
          ].map((id) => names.get(id) ?? 'User unavailable');
        r.source.excerpt = JSON.stringify(r.fields).slice(0, 3000);
      }
    } catch {
      index.warnings.push(
        'User directory lookup failed; some owner and team names are unavailable.',
      );
    }
    index.links = linkAuditRecords(index.records);
    if (index.incompleteKinds.length)
      index.warnings.push(
        `Indexing incomplete: ${index.incompleteKinds.join(', ')}. Limits: 5,000 records per kind, 20,000 total, 25 million indexed characters. Coverage percentage is unknown, not assumed.`,
      );
    if (index.restrictedKinds.length)
      index.warnings.push(
        `Read permissions exclude: ${index.restrictedKinds.join(', ')}. Coverage excludes records you cannot access.`,
      );
    if (index.textLimitedRecords)
      index.warnings.push(
        `${index.textLimitedRecords} records have missing or limited searchable document text. No OCR was performed.`,
      );
    return index;
  }
}
