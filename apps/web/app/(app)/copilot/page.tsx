'use client';

import * as React from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Bot, CheckCircle2, Clipboard, Sparkles, ThumbsUp } from 'lucide-react';
import { PageHeader, Section } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { StatTile } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Field } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { SimpleSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { AiContextDocuments } from '@/components/domain/ai-context-documents';
import { useAiFeedback, useAiInteractions, useCopilot } from '@/lib/queries/ai';
import { copyToClipboard } from '@/lib/utils';
import { fmtDateTime, fmtNumber } from '@/lib/format';
import type { AiCopilotResponse, AiFeature, AiInteraction } from '@/lib/types';

const FEATURES: { value: AiFeature; label: string; prompt: string }[] = [
  { value: 'planning.scope', label: 'Planning scope', prompt: 'Draft a risk-based audit scope for the selected area.' },
  { value: 'fieldwork.procedures', label: 'Audit procedures', prompt: 'Generate fieldwork procedures with evidence and exception criteria.' },
  { value: 'evidence.summary', label: 'Evidence summary', prompt: 'Summarise the evidence and identify gaps in sufficiency.' },
  { value: 'finding.draft', label: 'Finding draft', prompt: 'Draft a professional finding using condition, criteria, cause, impact and recommendation.' },
  { value: 'report.summary', label: 'Report summary', prompt: 'Prepare an executive summary for the audit report.' },
  { value: 'quality.check', label: 'Quality check', prompt: 'Check the file for IIA and BDO methodology documentation quality.' },
  { value: 'risk.radar', label: 'Risk radar', prompt: 'Assess risk signals and recommend audit priority changes.' },
  { value: 'search.nl', label: 'Natural language search', prompt: 'Translate this audit question into structured search filters and source records.' },
];

const TARGET_TYPES = [
  { value: 'Engagement', label: 'Engagement' },
  { value: 'Workpaper', label: 'Workpaper' },
  { value: 'Finding', label: 'Finding' },
  { value: 'Risk', label: 'Risk' },
];

function responseMarkdown(response: AiCopilotResponse) {
  return [
    `# ${response.title}`,
    '',
    response.narrative,
    '',
    '## Suggestions',
    ...response.suggestions.map((x) => `- ${x}`),
    '',
    '## Checklist',
    ...response.checklist.map((x) => `- [ ] ${x}`),
    '',
    '## Caveats',
    ...response.caveats.map((x) => `- ${x}`),
    ...(response.sources?.length ? ['', '## Context sources', ...response.sources.map((source) => `- ${source.fileName} (${source.characters} characters${source.truncated ? ', excerpt only' : ''})`)] : []),
  ].join('\n');
}

function ResultPanel({ result }: { result: AiCopilotResponse | null }) {
  if (!result) {
    return (
      <Section title="AI Sphere output">
        <div className="flex min-h-56 items-center justify-center text-center text-sm text-muted-foreground">
          <div>
            <Bot className="mx-auto mb-2 size-7" />
            <p>No response yet.</p>
          </div>
        </div>
      </Section>
    );
  }
  return (
    <Section
      title={result.title}
      description={`${result.provider.replace(/-/g, ' ')} - ${result.model} - ${fmtDateTime(result.createdAt)}`}
      actions={<Button variant="outline" size="sm" onClick={() => void copyToClipboard(responseMarkdown(result))}><Clipboard /> Copy</Button>}
    >
      <div className="space-y-4">
        <p className="whitespace-pre-wrap break-words text-sm leading-6">{result.narrative}</p>
        {result.sources?.length ? <div>
          <h3 className="mb-2 text-xs font-semibold">Context sources</h3>
          <ul className="space-y-1 text-xs text-muted-foreground">{result.sources.map((source) => <li key={source.documentId} className="break-words">{source.fileName} | {fmtNumber(source.characters)} characters{source.truncated ? ' | Excerpt only' : ''}</li>)}</ul>
        </div> : null}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Suggestions</p>
            <ul className="space-y-1.5">
              {result.suggestions.map((s) => <li key={s} className="rounded-md border border-border bg-muted/20 px-3 py-2 text-sm">{s}</li>)}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Checklist</p>
            <ul className="space-y-1.5">
              {result.checklist.map((s) => <li key={s} className="flex items-start gap-2 rounded-md border border-border bg-muted/20 px-3 py-2 text-sm"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" /> {s}</li>)}
            </ul>
          </div>
        </div>
        {result.caveats.length ? (
          <div className="rounded-md border border-warning/40 bg-warning/5 px-3 py-2">
            <p className="text-2xs font-semibold uppercase tracking-wider text-warning">Caveats</p>
            <p className="mt-1 text-xs text-muted-foreground">{result.caveats.join(' ')}</p>
          </div>
        ) : null}
      </div>
    </Section>
  );
}

function History() {
  const query = useAiInteractions({ pageSize: 10 });
  const feedback = useAiFeedback();
  const columns = React.useMemo<ColumnDef<AiInteraction, unknown>[]>(
    () => [
      { accessorKey: 'feature', header: 'Feature', cell: ({ getValue }) => <Badge variant="outline" className="normal-case tracking-normal">{FEATURES.find((f) => f.value === getValue<AiFeature>())?.label ?? getValue<string>()}</Badge> },
      { id: 'response', header: 'Response', cell: ({ row }) => <div className="min-w-0"><p className="truncate font-medium">{row.original.response?.title ?? row.original.feature}</p><p className="truncate text-2xs text-muted-foreground">{row.original.model} - {row.original.promptTokens + row.original.outputTokens} est. tokens</p></div> },
      { accessorKey: 'createdAt', header: 'Created', cell: ({ getValue }) => fmtDateTime(getValue<string>()), meta: { nowrap: true } },
      { accessorKey: 'rating', header: 'Rating', cell: ({ row }) => row.original.rating ? `${row.original.rating}/5` : '-', meta: { align: 'right' } },
      { id: 'actions', header: '', meta: { width: '60px', align: 'right' }, cell: ({ row }) => <Button variant="ghost" size="icon-sm" aria-label="Mark useful" onClick={() => feedback.mutate({ id: row.original.id, accepted: true, rating: 5 })}><ThumbsUp /></Button> },
    ],
    [feedback],
  );
  return <DataTable columns={columns} data={query.data?.items} isLoading={query.isLoading} error={query.error} onRetry={() => query.refetch()} total={query.data?.total} page={query.data?.page ?? 1} pageSize={query.data?.pageSize ?? 10} hideToolbar dense emptyIcon={<Bot />} emptyTitle="No AI Sphere history" storageKey="ai-history" />;
}

export default function CopilotPage() {
  const copilot = useCopilot();
  const [result, setResult] = React.useState<AiCopilotResponse | null>(null);
  const [draft, setDraft] = React.useState({ feature: 'planning.scope' as AiFeature, prompt: FEATURES[0].prompt, targetType: '', targetId: '', context: '' });
  const [documentIds, setDocumentIds] = React.useState<string[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const selected = FEATURES.find((f) => f.value === draft.feature);

  return (
    <>
      <PageHeader title="AI Sphere" description="Planning, fieldwork, evidence, findings, reporting and quality assistance." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Capability" value={<span className="block break-words text-base leading-snug">{selected?.label ?? 'AI Sphere'}</span>} icon={<Sparkles />} tone="primary" />
        <StatTile label="Provider" value={result?.provider === 'openai-compatible' ? 'AI' : 'Local'} hint={result?.model ?? 'Rulepack ready'} icon={<Bot />} tone="info" />
        <StatTile label="Suggestions" value={fmtNumber(result?.suggestions.length ?? 0)} icon={<Clipboard />} />
        <StatTile label="Checklist items" value={fmtNumber(result?.checklist.length ?? 0)} icon={<CheckCircle2 />} tone="success" />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Section title="Prompt" className="xl:col-span-1">
          <div className="space-y-3">
            <Field label="Capability" htmlFor="ai-feature">
              <SimpleSelect
                id="ai-feature"
                value={draft.feature}
                onValueChange={(feature) => setDraft({ ...draft, feature: feature as AiFeature, prompt: FEATURES.find((f) => f.value === feature)?.prompt ?? draft.prompt })}
                options={FEATURES.map(({ value, label }) => ({ value, label }))}
              />
            </Field>
            <Field label="Instruction" htmlFor="ai-prompt" required>
              <Textarea id="ai-prompt" rows={6} maxLength={8000} value={draft.prompt} onChange={(e) => setDraft({ ...draft, prompt: e.target.value })} />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Target type" htmlFor="ai-target-type">
                <SimpleSelect id="ai-target-type" value={draft.targetType} onValueChange={(targetType) => setDraft({ ...draft, targetType })} options={TARGET_TYPES} allowClear clearLabel="No target" placeholder="No target" />
              </Field>
              <Field label="Target id" htmlFor="ai-target-id">
                <Input id="ai-target-id" value={draft.targetId} onChange={(e) => setDraft({ ...draft, targetId: e.target.value })} placeholder="UUID" className="font-mono" />
              </Field>
            </div>
            <Field label="Context" htmlFor="ai-context">
              <Textarea id="ai-context" rows={4} maxLength={12000} value={draft.context} onChange={(e) => setDraft({ ...draft, context: e.target.value })} placeholder="Paste relevant policy, extract or audit background." />
            </Field>
            <AiContextDocuments selected={documentIds} onSelectionChange={setDocumentIds} onBusyChange={setUploading} disabled={copilot.isPending} />
            <Button
              className="w-full"
              loading={copilot.isPending}
              disabled={draft.prompt.trim().length < 3 || uploading || copilot.isPending}
              onClick={async () => {
                try {
                  const res = await copilot.mutateAsync({
                    feature: draft.feature,
                    prompt: draft.prompt.trim(),
                    targetType: draft.targetType || undefined,
                    targetId: draft.targetId || undefined,
                    context: draft.context || undefined,
                    documentIds,
                  });
                  setResult(res);
                } catch { /* The mutation displays the API error. */ }
              }}
            >
              <Sparkles /> Generate
            </Button>
          </div>
        </Section>
        <div className="space-y-4 xl:col-span-2">
          <ResultPanel result={result} />
          <Section title="Interaction history"><History /></Section>
        </div>
      </div>
    </>
  );
}
