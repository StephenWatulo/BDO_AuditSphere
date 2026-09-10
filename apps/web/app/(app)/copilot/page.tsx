'use client';

import * as React from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { AUDIT_SEARCH_KINDS, type AuditSearchKind, type PermissionKey } from '@auditsphere/shared';
import { Bot, Check, ChevronsUpDown, Eye, Search, Sparkles, ThumbsUp } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DataTable } from '@/components/ui/data-table';
import { Field } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { SimpleSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ErrorState } from '@/components/ui/empty-state';
import { SkeletonRows } from '@/components/ui/skeleton';
import { AiContextDocuments } from '@/components/domain/ai-context-documents';
import { AuditAssistantResult } from '@/components/domain/audit-assistant-result';
import { useCan } from '@/lib/auth';
import { useAiFeedback, useAiInteraction, useAiInteractions, useAiStatus, useAiTargets, useCopilot } from '@/lib/queries/ai';
import { fmtDateTime } from '@/lib/format';
import type { AiCopilotResponse, AiFeature, AiInteraction } from '@/lib/types';

const FEATURES: { value: AiFeature; label: string; prompt: string }[] = [
  { value: 'planning.scope', label: 'Planning scope', prompt: 'Develop a risk-based audit objective, scope, key risks, audit approach and required information list for this audit area.' },
  { value: 'fieldwork.procedures', label: 'Audit procedures', prompt: 'Develop procedures linked to the risk, control and test objective. Include expected evidence, exception criteria and sampling considerations.' },
  { value: 'evidence.summary', label: 'Evidence Review & Exception Analysis', prompt: 'Review evidence completeness, identify source-referenced exceptions, assess sufficiency and propose follow-up procedures.' },
  { value: 'finding.draft', label: 'Finding draft', prompt: 'Draft a complete Five Cs finding. Distinguish confirmed facts from potential causes and propose an actionable recommendation and justified risk rating.' },
  { value: 'report.summary', label: 'Report summary', prompt: 'Prepare an executive summary, findings dashboard and management themes. Distinguish recorded opinions from conclusions not yet supported.' },
  { value: 'quality.check', label: 'Quality check', prompt: 'Act as a senior reviewer: identify unsupported conclusions, inadequate procedures, missing evidence, inconsistent findings and weak recommendations. Provide specific review notes.' },
  { value: 'risk.radar', label: 'Risk radar', prompt: 'Review emerging risk signals, control weaknesses, repeated findings and previous audits. Recommend audit focus without changing stored risk ratings.' },
  { value: 'search.nl', label: 'Audit Intelligence Search', prompt: 'Show me all procurement-related findings identified across completed audits.' },
];
const TARGETS: { value: string; label: string; permission: PermissionKey }[] = [
  { value: 'Engagement', label: 'Engagement', permission: 'engagement:read' }, { value: 'Workpaper', label: 'Workpaper', permission: 'workpaper:read' },
  { value: 'Finding', label: 'Finding', permission: 'finding:read' }, { value: 'Control', label: 'Control', permission: 'control:read' },
  { value: 'Risk', label: 'Risk', permission: 'risk:read' }, { value: 'Evidence', label: 'Evidence', permission: 'document:read' },
  { value: 'Procedure', label: 'Audit procedure', permission: 'workpaper:read' }, { value: 'Process', label: 'Process', permission: 'universe:read' }, { value: 'Entity', label: 'Entity', permission: 'universe:read' },
];

function TargetPicker({ type, value, onChange }: { type: string; value: { id: string; label: string } | null; onChange: (value: { id: string; label: string } | null) => void }) {
  const [open, setOpen] = React.useState(false); const [q, setQ] = React.useState('');
  const targets = useAiTargets(type, q);
  return <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button id="ai-target" variant="outline" className="h-auto min-h-8 w-full justify-between whitespace-normal text-left" disabled={!type}><span className="min-w-0 break-words">{value?.label ?? 'Select audit record...'}</span><ChevronsUpDown className="shrink-0" /></Button></PopoverTrigger><PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-0 p-2"><Input aria-label="Search audit records" placeholder="Search by name or reference..." value={q} maxLength={120} onChange={(e) => setQ(e.target.value)} />{targets.isError ? <ErrorState compact error={targets.error} onRetry={() => targets.refetch()} /> : targets.isLoading ? <SkeletonRows rows={4} /> : <ul className="max-h-64 overflow-y-auto" aria-label="Audit records">{targets.data?.items.map((record) => <li key={record.id}><button type="button" className="flex w-full items-start gap-2 rounded-sm p-2 text-left text-xs hover:bg-muted" onClick={() => { onChange(record); setOpen(false); }}><span className="min-w-0 flex-1 break-words">{record.label}</span>{value?.id === record.id ? <Check className="size-4 shrink-0" /> : null}</button></li>)}{!targets.data?.items.length ? <li className="p-3 text-xs text-muted-foreground">No matching records</li> : null}</ul>}{value ? <Button className="mt-2 w-full" size="sm" variant="ghost" onClick={() => { onChange(null); setOpen(false); }}>Clear selection</Button> : null}</PopoverContent></Popover>;
}

function History({ onOpen }: { onOpen: (id: string) => void }) {
  const [page, setPage] = React.useState(1);
  const query = useAiInteractions({ page, pageSize: 10 }); const feedback = useAiFeedback();
  const columns = React.useMemo<ColumnDef<AiInteraction, unknown>[]>(() => [
    { accessorKey: 'feature', header: 'Capability', cell: ({ getValue }) => <span className="text-xs">{FEATURES.find((f) => f.value === getValue<AiFeature>())?.label ?? getValue<string>()}</span> },
    { accessorKey: 'model', header: 'Model', cell: ({ getValue }) => <span className="break-words text-xs">{getValue<string>()}</span> },
    { accessorKey: 'createdAt', header: 'Created', cell: ({ getValue }) => fmtDateTime(getValue<string>()) },
    { id: 'actions', header: '', cell: ({ row }) => <div className="flex gap-1"><Button variant="ghost" size="icon-sm" aria-label="Open interaction" title="Open interaction" onClick={(event) => { event.stopPropagation(); onOpen(row.original.id); }}><Eye /></Button><Button variant="ghost" size="icon-sm" aria-label="Mark useful" title="Mark useful, not an audit approval" onClick={(event) => { event.stopPropagation(); feedback.mutate({ id: row.original.id, accepted: true, rating: 5 }); }}><ThumbsUp /></Button></div> },
  ], [feedback, onOpen]);
  return <DataTable columns={columns} data={query.data?.items} isLoading={query.isLoading} error={query.error} onRetry={() => query.refetch()} total={query.data?.total} page={page} pageSize={10} onPageChange={setPage} hideToolbar dense emptyIcon={<Bot />} emptyTitle="No AI Sphere history" onRowClick={(r) => onOpen(r.id)} storageKey="ai-history" />;
}

export default function CopilotPage() {
  const can = useCan(); const copilot = useCopilot(); const status = useAiStatus();
  const [result, setResult] = React.useState<AiCopilotResponse | null>(null);
  const [historyId, setHistoryId] = React.useState<string | null>(null); const history = useAiInteraction(historyId);
  React.useEffect(() => { if (history.data && !history.isFetching && !history.error) setResult(history.data); }, [history.data, history.isFetching, history.error]);
  const [draft, setDraft] = React.useState({ feature: 'planning.scope' as AiFeature, prompt: FEATURES[0].prompt, targetType: '', context: '', impact: '', likelihood: '', populationSize: '', ratingRationale: '' });
  const [target, setTarget] = React.useState<{ id: string; label: string } | null>(null);
  const [searchScope, setSearchScope] = React.useState<'universe' | 'engagement'>('universe');
  const [searchEngagement, setSearchEngagement] = React.useState<{ id: string; label: string } | null>(null);
  const [searchKinds, setSearchKinds] = React.useState<AuditSearchKind[]>([...AUDIT_SEARCH_KINDS]);
  const isSearch = draft.feature === 'search.nl';
  const [documentIds, setDocumentIds] = React.useState<string[]>([]); const [uploading, setUploading] = React.useState(false);
  const onHistory = (id: string) => { setResult(null); setHistoryId(id); if (id === historyId) void history.refetch(); };
  return <>
    <PageHeader title="AI Sphere" description="Internal Audit AI Assistant" />
    <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-y border-border py-3 text-xs">
      <span>Provider: <strong>{status.isLoading ? 'Loading...' : status.error ? 'Unavailable' : status.data?.provider === 'openai-compatible' ? 'Configured model' : 'Local rule-based review'}</strong></span>
      <span>Sources: <strong>{result?.sourceRegister?.length ?? 0}</strong></span><span>Reviewer notes: <strong>{result?.reviewerNotes?.length ?? 0}</strong></span><span>Exceptions / gaps: <strong>{result?.exceptions?.length ?? 0}</strong></span>
      <Badge variant="outline">Draft assistance only</Badge>
    </div>
    <div className="grid min-w-0 grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(300px,360px)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-4">
        <fieldset disabled={copilot.isPending} className="min-w-0 space-y-4 disabled:opacity-75">
          <Field label="Capability" htmlFor="ai-feature"><SimpleSelect id="ai-feature" value={draft.feature} onValueChange={(feature) => { setDraft({ ...draft, feature: feature as AiFeature, prompt: FEATURES.find((f) => f.value === feature)?.prompt ?? '' }); setResult(null); setHistoryId(null); }} options={FEATURES.map(({ value, label }) => ({ value, label }))} className="h-auto min-h-8 whitespace-normal py-2 text-left" /></Field>
          <Field label="Instruction" htmlFor="ai-prompt" required><Textarea id="ai-prompt" rows={5} maxLength={8000} value={draft.prompt} onChange={(e) => setDraft({ ...draft, prompt: e.target.value })} /></Field>
          {isSearch ? <>
            <Field label="Search scope" htmlFor="ai-search-scope"><SimpleSelect id="ai-search-scope" value={searchScope} onValueChange={(v) => setSearchScope(v as 'universe' | 'engagement')} options={[{ value: 'universe', label: 'All audit universe' }, { value: 'engagement', label: 'Current engagement' }]} /></Field>
            {searchScope === 'engagement' ? <Field label="Current engagement" htmlFor="ai-target"><TargetPicker type="Engagement" value={searchEngagement} onChange={setSearchEngagement} /></Field> : null}
            <fieldset className="space-y-2"><legend className="mb-2 text-sm font-medium">Record types</legend><label className="flex items-center gap-2 text-xs"><Checkbox checked={searchKinds.length === AUDIT_SEARCH_KINDS.length ? true : searchKinds.length ? 'indeterminate' : false} onCheckedChange={(v) => setSearchKinds(v ? [...AUDIT_SEARCH_KINDS] : [])} />All record types</label><div className="grid grid-cols-2 gap-2">{AUDIT_SEARCH_KINDS.map((kind) => <label key={kind} className="flex items-center gap-2 text-xs"><Checkbox checked={searchKinds.includes(kind)} onCheckedChange={(v) => setSearchKinds((old) => v ? [...old, kind] : old.filter((k) => k !== kind))} />{kind === 'ActionPlan' ? 'Action plans' : kind === 'Entity' ? 'Entities' : kind === 'Process' ? 'Processes' : kind === 'Evidence' ? kind : `${kind}s`}</label>)}</div></fieldset>
          </> : <>
            <Field label="Audit context type" htmlFor="ai-target-type"><SimpleSelect id="ai-target-type" value={draft.targetType} onValueChange={(targetType) => { setDraft({ ...draft, targetType }); setTarget(null); }} options={TARGETS.filter((t) => can(t.permission))} allowClear clearLabel="No target" placeholder="No target" /></Field>
            {draft.targetType ? <Field label="Audit record" htmlFor="ai-target"><TargetPicker key={draft.targetType} type={draft.targetType} value={target} onChange={setTarget} /></Field> : null}
            <Field label="Additional context" htmlFor="ai-context"><Textarea id="ai-context" rows={4} maxLength={12000} value={draft.context} onChange={(e) => setDraft({ ...draft, context: e.target.value })} placeholder="Relevant background, scope constraints or reviewer instructions..." /></Field>
          </>}
          {draft.feature === 'finding.draft' ? <>
            <div className="grid grid-cols-2 gap-3"><Field label="Impact (1-5)" htmlFor="ai-impact"><Input id="ai-impact" type="number" min={1} max={5} step={1} value={draft.impact} onChange={(e) => setDraft({ ...draft, impact: e.target.value })} /></Field><Field label="Likelihood (1-5)" htmlFor="ai-likelihood"><Input id="ai-likelihood" type="number" min={1} max={5} step={1} value={draft.likelihood} onChange={(e) => setDraft({ ...draft, likelihood: e.target.value })} /></Field></div>
            <Field label="Rating rationale" htmlFor="ai-rating-rationale"><Textarea id="ai-rating-rationale" maxLength={1200} rows={2} value={draft.ratingRationale} onChange={(e) => setDraft({ ...draft, ratingRationale: e.target.value })} /></Field>
          </> : null}
          {draft.feature === 'fieldwork.procedures' ? <Field label="Population size" htmlFor="ai-population"><Input id="ai-population" type="number" min={1} max={100000000} step={1} value={draft.populationSize} onChange={(e) => setDraft({ ...draft, populationSize: e.target.value })} /></Field> : null}
          {!isSearch ? <AiContextDocuments selected={documentIds} onSelectionChange={setDocumentIds} onBusyChange={setUploading} disabled={copilot.isPending} /> : null}
        </fieldset>
        <Button className="w-full" loading={copilot.isPending} title={isSearch && !status.data?.intelligenceSearch ? 'Audit Intelligence requires the updated API. Restart the API and refresh this page.' : undefined} disabled={draft.prompt.trim().length < 3 || (isSearch ? !status.data?.intelligenceSearch || !searchKinds.length || searchScope === 'engagement' && !searchEngagement : uploading || !!draft.targetType && !target) || draft.feature === 'finding.draft' && !!draft.impact !== !!draft.likelihood} onClick={async () => {
          setHistoryId(null); setResult(null);
          try { const res = await copilot.mutateAsync({ feature: draft.feature, prompt: draft.prompt.trim(), ...(isSearch ? { searchScope, searchEngagementId: searchScope === 'engagement' ? searchEngagement?.id : undefined, searchKinds: searchKinds.length === AUDIT_SEARCH_KINDS.length ? undefined : searchKinds } : { targetType: draft.targetType || undefined, targetId: target?.id, context: draft.context || undefined, documentIds }), ...(draft.feature === 'finding.draft' && draft.impact && draft.likelihood ? { impact: Number(draft.impact), likelihood: Number(draft.likelihood), ratingRationale: draft.ratingRationale || undefined } : {}), ...(draft.feature === 'fieldwork.procedures' && draft.populationSize ? { populationSize: Number(draft.populationSize) } : {}) }); setResult(res); } catch { /* Mutation reports the API validation or access error. */ }
        }}>{draft.feature === 'search.nl' ? <Search /> : <Sparkles />}{draft.feature === 'search.nl' ? 'Search audit records' : 'Generate review'}</Button>
      </div>
      <div className="min-w-0 space-y-5">
        {historyId && history.isFetching ? <SkeletonRows rows={8} /> : historyId && history.error ? <ErrorState title="Could not open interaction" error={history.error} onRetry={() => history.refetch()} /> : !historyId && copilot.isPending ? <SkeletonRows rows={8} /> : !historyId && copilot.error ? <ErrorState title={isSearch ? 'Audit search failed' : 'Review failed'} error={copilot.error} /> : <AuditAssistantResult result={result} searching={copilot.isPending} onSearchPage={async (page) => { const query = result?.search?.intelligence?.query; if (!query) return; setHistoryId(null); try { setResult(await copilot.mutateAsync({ ...query, feature: 'search.nl', searchPage: page })); } catch { /* API error is reported by the mutation. */ } }} />}
        <section className="min-w-0 border-t border-border pt-4"><h2 className="mb-3 text-sm font-semibold">Interaction history</h2><History onOpen={onHistory} /></section>
      </div>
    </div>
  </>;
}
