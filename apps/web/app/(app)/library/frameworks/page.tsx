'use client';

import * as React from 'react';
import { BookMarked, ChevronDown, ChevronRight, Search } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { SkeletonCard } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { useFrameworks } from '@/lib/queries/library';
import type { Framework } from '@/lib/types';

function FrameworkCard({ framework, query }: { framework: Framework; query: string }) {
  const [open, setOpen] = React.useState(false);
  const refs = framework.references ?? [];
  const q = query.trim().toLowerCase();
  const visible = q ? refs.filter((r) => r.refCode.toLowerCase().includes(q) || r.title.toLowerCase().includes(q) || (r.description ?? '').toLowerCase().includes(q)) : refs;
  React.useEffect(() => { if (q) setOpen(visible.length > 0); }, [q, visible.length]);
  if (q && visible.length === 0 && !framework.name.toLowerCase().includes(q) && !framework.code.toLowerCase().includes(q)) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="surface">
      <CollapsibleTrigger className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/40">
        {open ? <ChevronDown className="mt-1 size-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="font-mono normal-case tracking-normal">{framework.code}</Badge>
            <h2 className="text-sm font-semibold">{framework.name}</h2>
            {framework.version ? <span className="text-xs text-muted-foreground">v{framework.version}</span> : null}
          </div>
          {framework.description ? <p className="mt-0.5 text-xs text-muted-foreground">{framework.description}</p> : null}
        </div>
        <Badge variant="muted">{q ? `${visible.length} / ${refs.length}` : refs.length} refs</Badge>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {visible.length === 0 ? (
          <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">No references recorded for this framework.</p>
        ) : (
          <ul className="divide-y divide-border border-t border-border">
            {visible.map((r) => (
              <li key={r.id} className="flex items-start gap-3 px-4 py-2">
                <span className="w-24 shrink-0 font-mono text-xs text-muted-foreground">{r.refCode}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{r.title}</p>
                  {r.description ? <p className="text-xs text-muted-foreground">{r.description}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function FrameworksPage() {
  const { data, isLoading, error, refetch } = useFrameworks();
  const [query, setQuery] = React.useState('');
  const frameworks = React.useMemo(() => [...(data ?? [])].sort((a, b) => a.code.localeCompare(b.code)), [data]);
  const totalRefs = frameworks.reduce((n, f) => n + (f.references?.length ?? 0), 0);

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Library', href: '/library' }, { label: 'Frameworks' }]}
        title="Frameworks"
        description={`Control and risk frameworks used to tag controls and library content. ${frameworks.length ? `${frameworks.length} frameworks · ${totalRefs} references.` : ''}`}
        actions={
          <div className="relative w-64">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search references…" className="pl-7" aria-label="Search framework references" />
          </div>
        }
      />
      {isLoading ? (
        <div className="space-y-3"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : frameworks.length === 0 ? (
        <EmptyState icon={<BookMarked />} title="No frameworks" description="Frameworks are seeded with the tenant (COSO, COBIT, ISO 31000, ISO 27001, IFRS, SOX, IIA)." />
      ) : (
        <div className="space-y-3">{frameworks.map((f) => <FrameworkCard key={f.id} framework={f} query={query} />)}</div>
      )}
    </>
  );
}
