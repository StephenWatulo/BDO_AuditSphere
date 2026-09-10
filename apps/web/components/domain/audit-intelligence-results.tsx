'use client';

import Link from 'next/link';
import type { AuditSearchSummary, AuditSource } from '@auditsphere/shared';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { humanize } from '@/lib/utils';

export function AuditIntelligenceResults({
  search,
  sources,
  onSource,
  onPage,
  pending,
}: {
  search: NonNullable<AuditSearchSummary['intelligence']>;
  sources: AuditSource[];
  onSource: (id: string) => void;
  onPage?: (page: number) => void;
  pending?: boolean;
}) {
  const byId = new Map(sources.map((s) => [s.id, s]));
  const sourceLink = (id: string) => {
    const s = byId.get(id);
    return s ? (
      <span key={id} className="inline-flex max-w-full items-start gap-1">
        {s.href ? (
          <Link href={s.href} className="break-words text-primary underline underline-offset-2">
            {s.label}
          </Link>
        ) : (
          <button
            className="break-words text-left text-primary underline"
            onClick={() => onSource(id)}
          >
            {s.label}
          </button>
        )}
        <button
          title="View source snapshot"
          className="shrink-0 font-mono text-primary"
          onClick={() => onSource(id)}
        >
          [{id}]
        </button>
      </span>
    ) : null;
  };
  return (
    <section aria-label="Audit intelligence results" className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-start gap-x-6 gap-y-3 border-y border-border py-3 text-xs">
        <div>
          <div className="text-muted-foreground">Search coverage</div>
          <strong>
            {search.coveragePercent === null
              ? 'Incomplete / unknown'
              : `${search.coveragePercent}% of accessible record metadata`}
          </strong>
        </div>
        <div>
          <div className="text-muted-foreground">Sources analysed</div>
          <strong>{search.sourcesAnalysed.toLocaleString()}</strong>
        </div>
        <div>
          <div className="text-muted-foreground">Retrieval confidence</div>
          <Badge variant="outline">{search.confidence}</Badge>
        </div>
        <div>
          <div className="text-muted-foreground">Matches / engagements</div>
          <strong>
            {search.totalMatches} / {search.engagementCount}
          </strong>
        </div>
      </div>
      <details className="text-xs">
        <summary className="cursor-pointer font-medium">Coverage details</summary>
        <p className="mt-2">{search.coverageBasis}</p>
        <p className="mt-1">{search.confidenceReason}</p>
        <div className="mt-2 space-y-1">
          <div>Indexed: {new Date(search.indexedAt).toLocaleString()}</div>
          <div>
            Permission exclusions: {search.restrictedKinds.join(', ') || 'None at module level'}
          </div>
          <div>Incomplete indexing: {search.incompleteKinds.join(', ') || 'None detected'}</div>
          <div>Missing / limited document text: {search.textLimitedRecords}</div>
        </div>
      </details>
      {!search.totalMatches ? (
        <div className="border-y border-border py-4 text-sm">
          <p className="font-medium">No matching records found.</p>
          <p className="mt-1">
            {
              {
                no_data: 'No indexed records exist for the requested record types.',
                no_match: 'No records matched the interpreted terms and filters.',
                permissions: 'Permissions restrict the requested record types.',
                incomplete: 'Indexing was incomplete; an absence of matches is inconclusive.',
              }[search.emptyReason ?? 'no_match']
            }
          </p>
        </div>
      ) : (
        <>
          <div
            role="region"
            aria-label="Audit intelligence table"
            tabIndex={0}
            className="max-w-full overflow-x-auto border border-border"
          >
            <table
              className="w-full min-w-[1250px] table-fixed text-left text-xs"
              aria-label="Audit intelligence results"
            >
              <colgroup>
                {[280, 140, 110, 150, 120, 110, 340].map((w, i) => (
                  <col key={i} style={{ width: w }} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  {[
                    'Record',
                    'Engagement',
                    'Severity / rating',
                    'Owner',
                    'Status',
                    'Due date',
                    'Intelligence / traceability',
                  ].map((h, i) => (
                    <th key={h} scope="col" className={`border-b border-border bg-muted p-2 ${i === 0 ? 'md:sticky md:left-0 md:z-20' : ''}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {search.rows.map((r) => (
                  <tr key={r.sourceId} className="border-b border-border align-top">
                    <td className="break-words bg-card p-2 md:sticky md:left-0 md:z-10 md:border-r md:border-border">
                      <div className="mb-1 text-2xs uppercase text-muted-foreground">
                        {humanize(r.kind)}
                      </div>
                      {sourceLink(r.sourceId)}
                    </td>
                    <td className="break-words p-2">{r.engagement}</td>
                    <td className="break-words p-2">{humanize(r.severity)}</td>
                    <td className="break-words p-2">{r.owner}</td>
                    <td className="break-words p-2">{humanize(r.status)}</td>
                    <td className="p-2">{r.dueDate.slice(0, 10) || 'Not set'}</td>
                    <td className="break-words p-2">
                      <p>{r.detail}</p>
                      <details className="mt-2">
                        <summary className="cursor-pointer font-medium">
                          Linked source records ({r.traceIds.length})
                        </summary>
                        <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto">
                          {r.traceIds.map((id) => (
                            <li key={id}>
                              <span className="block text-2xs text-muted-foreground">
                                {byId.get(id)?.kind}
                              </span>
                              {sourceLink(id)}
                            </li>
                          ))}
                        </ul>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-2 text-xs">
            <span>
              Page {search.page} of {Math.max(1, Math.ceil(search.totalMatches / search.pageSize))}
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="icon-sm"
                title="Previous results"
                aria-label="Previous results"
                disabled={pending || !onPage || search.page <= 1}
                onClick={() => onPage?.(search.page - 1)}
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                title="Next results"
                aria-label="Next results"
                disabled={
                  pending || !onPage || search.page * search.pageSize >= search.totalMatches
                }
                onClick={() => onPage?.(search.page + 1)}
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
