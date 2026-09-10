'use client';

import * as React from 'react';
import Link from 'next/link';
import { AI_REVIEW_NOTICE, EXCEPTION_REGISTER_TITLE, type AssistantContent } from '@auditsphere/shared';
import { Bot, Clipboard, Download, ExternalLink, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { errorMessage } from '@/lib/api';
import { downloadDocument } from '@/lib/queries/documents';
import { copyToClipboard, humanize } from '@/lib/utils';
import { fmtDateTime } from '@/lib/format';
import type { AiCopilotResponse } from '@/lib/types';
import { AuditIntelligenceResults } from './audit-intelligence-results';

export function assistantMarkdown(result: AiCopilotResponse) {
  const lines = [`# ${result.title}`, '', AI_REVIEW_NOTICE, '', `${result.model} | ${result.createdAt}`, '', result.narrative];
  for (const section of result.sections ?? []) {
    lines.push('', `## ${section.title}`, ...section.items.map((i) => `- [${i.basis}] ${i.text} ${i.sourceIds.map((s) => `[${s}]`).join(' ')}`));
    if (section.columns.length) lines.push(`| ${section.columns.join(' | ')} | Basis / sources |`, `| ${[...section.columns, 'Basis / sources'].map(() => '---').join(' | ')} |`, ...section.rows.map((r) => `| ${r.cells.map((c) => c.replace(/\|/g, '\\|').replace(/\n/g, ' ')).join(' | ')} | ${r.basis} ${r.sourceIds.map((s) => `[${s}]`).join(' ')} |`));
  }
  if (result.evidenceAssessment) lines.push('', '## Evidence assessment', result.evidenceAssessment.status, result.evidenceAssessment.rationale);
  for (const e of result.exceptions ?? []) lines.push('', `### ${e.reference}: ${e.status} exception (${e.severity})`, e.observation, `Risk: ${e.risk}`, e.sourceIds.join(', '));
  for (const n of result.reviewerNotes ?? []) lines.push('', `### Reviewer note: ${n.area} (${n.priority})`, n.comment, n.sourceIds.join(', '));
  if (result.ratingProposal) lines.push('', '## Proposed rating only', `${result.ratingProposal.impact ?? '?'} x ${result.ratingProposal.likelihood ?? '?'} = ${result.ratingProposal.score ?? '?'} (${result.ratingProposal.rating})`, result.ratingProposal.rationale);
  lines.push('', '## Review checklist', ...result.checklist.map((c) => `- [ ] ${c}`), '', '## Caveats', ...result.caveats.map((c) => `- ${c}`));
  lines.push('', '## Source register', ...(result.sourceRegister ?? []).map((s) => `- [${s.id}] ${s.kind}: ${s.label} (${s.recordId})${s.truncated ? ' - excerpt only' : ''}${s.href ? ` ${s.href}` : ''}`));
  return lines.join('\n');
}

export function AuditAssistantResult({ result, onSearchPage, searching }: { result: AiCopilotResponse | null; onSearchPage?: (page: number) => void; searching?: boolean }) {
  const [tab, setTab] = React.useState('review');
  const [source, setSource] = React.useState<string | null>(null);
  React.useEffect(() => { setTab('review'); setSource(null); }, [result?.id]);
  React.useEffect(() => { if (tab === 'sources' && source) document.getElementById(`audit-source-${source}`)?.scrollIntoView({ block: 'nearest' }); }, [tab, source]);
  const citations = (ids: string[]) => <span className="inline-flex flex-wrap gap-1">{ids.map((id) => <button key={id} type="button" className="font-mono text-xs text-primary underline underline-offset-2" title={`View source ${id}`} onClick={() => { setSource(id); setTab('sources'); }}>[{id}]</button>)}</span>;
  const register = result?.sections?.find((s) => s.title === EXCEPTION_REGISTER_TITLE);
  const registeredIds = new Set(register?.rows.map((r) => r.cells[0]));
  const otherExceptions = result?.exceptions?.filter((e) => !registeredIds.has(e.reference)) ?? [];
  const renderSection = (section: AssistantContent['sections'][number], index: number | string) => {
    const isRegister = section.title === EXCEPTION_REGISTER_TITLE;
    return <section key={index} className="min-w-0 border-t border-border pt-4"><h3 className="mb-2 break-words text-sm font-semibold">{section.title}{isRegister ? ` (${section.rows.length})` : ''}</h3><ul className="space-y-3">{section.items.map((i, n) => <li key={n} className="text-sm"><span className="mr-2 text-2xs font-semibold uppercase text-muted-foreground">{i.basis}</span><span className="whitespace-pre-wrap break-words">{i.text}</span> {citations(i.sourceIds)}</li>)}</ul>{section.columns.length > 0 ? <div role="region" aria-label={`${section.title} table`} tabIndex={isRegister ? 0 : undefined} className="mt-3 max-w-full overflow-x-auto rounded-sm border border-border"><table aria-label={section.title} className={`w-full table-fixed text-left text-xs ${isRegister ? 'min-w-[2200px]' : ''}`}>
      {isRegister ? <colgroup>{[110, 150, 170, 150, 260, 300, 320, 240, 150, 300].map((width, i) => <col key={i} style={{ width }} />)}</colgroup> : null}
      <thead><tr>{section.columns.map((c, i) => <th key={c} scope="col" className={`break-words border-b border-border bg-muted p-2 font-semibold ${isRegister && i === 0 ? 'sticky left-0 z-10' : ''}`}>{c}</th>)}</tr></thead><tbody>{section.rows.map((r, n) => <tr key={n} className="border-b border-border align-top">{r.cells.map((cell, j) => <td key={j} className={`break-words p-2 ${isRegister && j === 0 ? 'sticky left-0 border-r border-border bg-card font-mono' : ''}`}>{cell}{j === (isRegister ? 0 : r.cells.length - 1) ? <div className="mt-2 space-x-1"><span className="text-2xs uppercase text-muted-foreground">{r.basis}</span> {citations(r.sourceIds)}</div> : null}</td>)}</tr>)}</tbody></table></div> : null}</section>;
  };
  const download = () => {
    if (!result) return;
    const url = URL.createObjectURL(new Blob([assistantMarkdown(result)], { type: 'text/markdown;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `AI-Sphere-review-${result.id}.md`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <div className="min-w-0 rounded-md border border-border bg-card">
    <div className="flex items-start gap-2 border-b border-warning/30 bg-warning/5 px-4 py-3 text-xs"><ShieldAlert className="size-4 shrink-0 text-warning" /><p>{AI_REVIEW_NOTICE}</p></div>
    {!result ? <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-muted-foreground"><Bot className="size-7" /><p className="text-sm">No review generated.</p></div> : <>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4">
        <div className="min-w-0 flex-1"><h2 className="break-words text-base font-semibold">{result.title}</h2><p className="mt-1 break-words text-xs text-muted-foreground">{humanize(result.provider)} | {result.model} | {fmtDateTime(result.createdAt)}</p></div>
        <div className="flex gap-1"><Button variant="outline" size="icon-sm" aria-label="Copy audit review" title="Copy audit review" onClick={() => void copyToClipboard(assistantMarkdown(result))}><Clipboard /></Button><Button variant="outline" size="icon-sm" aria-label="Download audit review" title="Download Markdown review" onClick={download}><Download /></Button></div>
      </header>
      <Tabs value={tab} onValueChange={setTab} className="min-w-0 p-4">
        <TabsList className="max-w-full overflow-x-auto"><TabsTrigger value="review">Review</TabsTrigger><TabsTrigger value="sources">Sources ({result.sourceRegister?.length ?? 0})</TabsTrigger><TabsTrigger value="links">Context links</TabsTrigger></TabsList>
        <TabsContent value="review" className="min-w-0 space-y-4">
          <p className="whitespace-pre-wrap break-words text-sm leading-6">{result.narrative}</p>
          {result.search?.intelligence ? <AuditIntelligenceResults search={result.search.intelligence} sources={result.sourceRegister ?? []} onSource={(id) => { setSource(id); setTab('sources'); }} onPage={onSearchPage} pending={searching} /> : null}
          {!result.search?.intelligence && result.provider !== 'openai-compatible' ? <p className="text-xs text-muted-foreground">Rule-based review. Unstructured narrative, image evidence and complex causal relationships require additional auditor analysis.</p> : null}
          {result.search && !result.search.intelligence ? <div className="border-y border-border py-3 text-xs"><p>Keywords: {result.search.terms.join(', ') || 'No keyword restriction'}</p><p>Exception filter: {result.search.exceptionsOnly ? 'Yes (recorded control-test counts)' : 'No'}</p>{result.search.from ? <p>Dates: {result.search.from.slice(0, 10)} to {result.search.to?.slice(0, 10)}</p> : null}</div> : null}
          {result.evidenceAssessment && !result.search?.intelligence ? <section className="border-y border-border py-3"><h3 className="mb-2 text-sm font-semibold">Evidence sufficiency</h3><Badge variant="outline">{humanize(result.evidenceAssessment.status)}</Badge><p className="mt-2 text-sm">{result.evidenceAssessment.rationale}</p></section> : null}
          {register ? renderSection(register, 'exception-register') : null}
          {(result.reviewerNotes?.length ?? 0) > 0 ? <section><h3 className="mb-2 text-sm font-semibold">Reviewer notes ({result.reviewerNotes!.length})</h3><ol className="divide-y divide-border">{result.reviewerNotes!.map((n, i) => <li key={i} className="py-3"><div className="flex flex-wrap items-center gap-2"><Badge variant={n.priority === 'HIGH' ? 'danger' : 'outline'}>{n.priority}</Badge><h4 className="text-sm font-medium">{n.area}</h4></div><p className="mt-1 break-words text-sm">{n.comment}</p>{citations(n.sourceIds)}</li>)}</ol></section> : null}
          {otherExceptions.length > 0 ? <section><h3 className="mb-2 text-sm font-semibold">Other exceptions and evidence gaps</h3><ol className="divide-y divide-border">{otherExceptions.map((e) => <li key={e.reference} className="py-3 text-sm"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs">{e.reference}</span><Badge variant="outline">{e.status}</Badge><span className="text-xs">{e.severity}</span></div><p className="mt-1 break-words">{e.observation}</p><p className="mt-1 break-words text-xs text-muted-foreground">Risk: {e.risk}</p>{citations(e.sourceIds)}</li>)}</ol></section> : null}
          {result.sections?.filter((s) => s.title !== EXCEPTION_REGISTER_TITLE && !(result.search?.intelligence && ['Results', 'Coverage'].includes(s.title))).map(renderSection)}
          {result.ratingProposal && !result.search?.intelligence ? <section className="border-t border-border pt-4"><h3 className="mb-2 text-sm font-semibold">Proposed rating only</h3><p className="font-mono text-sm">{result.ratingProposal.impact ?? '?'} x {result.ratingProposal.likelihood ?? '?'} = {result.ratingProposal.score ?? '?'} ({result.ratingProposal.rating})</p><p className="mt-2 text-sm">{result.ratingProposal.rationale}</p>{citations(result.ratingProposal.sourceIds)}</section> : null}
          <section className="border-t border-border pt-4"><h3 className="mb-2 text-sm font-semibold">Auditor review checklist</h3><ul className="list-inside list-disc space-y-1 text-sm">{result.checklist.map((c) => <li key={c}>{c}</li>)}</ul></section>
          <section className="border-t border-warning/30 pt-4"><h3 className="mb-2 text-sm font-semibold">Limitations</h3><ul className="list-inside list-disc space-y-1 break-words text-xs text-muted-foreground">{result.caveats.map((c, i) => <li key={i}>{c}</li>)}</ul></section>
        </TabsContent>
        <TabsContent value="sources" className="space-y-3">
          {result.prompt ? <p className="whitespace-pre-wrap break-words border-b border-border pb-3 text-sm">Instruction: {result.prompt}</p> : null}
          {!result.sourceRegister?.length ? <p className="text-sm text-muted-foreground">No source register is available for this interaction.</p> : result.sourceRegister.map((s) => <section key={s.id} id={`audit-source-${s.id}`} className={`border-b border-border py-3 ${source === s.id ? 'bg-accent/30' : ''}`}><div className="flex items-start justify-between gap-2"><div className="min-w-0"><h3 className="break-words text-sm font-semibold">[{s.id}] {s.label}</h3><p className="text-xs text-muted-foreground">{s.kind}{s.truncated ? ' | Excerpt only' : ''}</p></div><div className="flex shrink-0 gap-1">{s.href ? <Button size="icon-sm" variant="ghost" asChild title="Open source record"><Link href={s.href} aria-label={`Open ${s.label}`}><ExternalLink /></Link></Button> : null}{s.kind === 'Document' ? <Button size="icon-sm" variant="ghost" title="Download source document" aria-label={`Download ${s.label}`} onClick={async () => { try { await downloadDocument(s.recordId); } catch (error) { toast.error(errorMessage(error)); } }}><Download /></Button> : null}</div></div><p className="mt-2 whitespace-pre-wrap break-words text-xs leading-5">{s.excerpt}</p></section>)}
        </TabsContent>
        <TabsContent value="links"><ul className="divide-y divide-border">{result.contextLinks?.length ? result.contextLinks.map((l, i) => <li key={i} className="py-2 text-xs">{citations([l.from])} {result.sourceRegister?.find((s) => s.id === l.from)?.label}<span className="mx-2 text-muted-foreground">{l.relationship}</span>{citations([l.to])} {result.sourceRegister?.find((s) => s.id === l.to)?.label}</li>) : <li className="py-3 text-sm text-muted-foreground">No confirmed record links were retrieved.</li>}</ul></TabsContent>
      </Tabs>
    </>}
  </div>;
}
