'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { Check, ClipboardCheck, FilePlus2, FileText, Inbox, Milestone, Paperclip, Pencil, Plus, Trash2, Users, X } from 'lucide-react';
import { ENGAGEMENT_STAGES, ENGAGEMENT_WORKFLOW, STAGE_LABELS, SEVERITIES, type EngagementStage } from '@auditsphere/shared';
import { PageHeader, Section, DescriptionItem } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { SimpleSelect } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '@/components/ui/data-table';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton, SkeletonRows } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { UserAvatar } from '@/components/ui/avatar';
import { StageStepper } from '@/components/domain/stage-stepper';
import { WorkflowActions } from '@/components/domain/guard-dialog';
import { FindingStatusBadge, RequestStatusBadge, SeverityBadge, StageBadge, WorkpaperStatusBadge, GenericStatusBadge } from '@/components/domain/badges';
import { HistoryTimeline } from '@/components/domain/history-timeline';
import { CommentsThread } from '@/components/domain/comments-thread';
import { UserPicker } from '@/components/domain/user-picker';
import { FileUpload } from '@/components/domain/file-upload';
import { DocumentsPanel } from '@/components/domain/documents-panel';
import { ReportExport } from '@/components/domain/report-export';
import { JsonDiff } from '@/components/domain/json-diff';
import { ProgrammeTab } from '@/components/engagements/programme-tab';
import { ReportTab } from '@/components/engagements/report-tab';
import { Can, useCan } from '@/lib/auth';
import { useAddMember, useAddMilestone, useAddStakeholder, useCreateWorkpaper, useDeleteMilestone, useEngagement, useEngagementEvidence, useEngagementTransition, useEngagementWorkpapers, useRemoveMember, useRemoveStakeholder, useUpdateEngagement, useUpdateMilestone, type EngagementInput } from '@/lib/queries/engagements';
import { useFindings } from '@/lib/queries/findings';
import { useRequests, useCreateRequest } from '@/lib/queries/requests';
import { useAuditTrail } from '@/lib/queries/collaboration';
import { useCreateEvidence, downloadDocument } from '@/lib/queries/documents';
import { ENGAGEMENT_ROLE_LABELS, ENGAGEMENT_TYPE_LABELS, EVIDENCE_TYPE_LABELS, enumOptions } from '@/lib/labels';
import { fmtDate, fmtDateTime, fmtHours, isOverdue, toInputDate } from '@/lib/format';
import { cn, humanize } from '@/lib/utils';
import type { Document, DocumentRequest, Engagement, EngagementRole, Evidence, EvidenceType, FindingSummary, WorkpaperSummary } from '@/lib/types';

const TABS = ['overview', 'programme', 'workpapers', 'documents', 'evidence', 'findings', 'requests', 'report', 'history', 'comments'] as const;
type Tab = (typeof TABS)[number];

/** Inline editable field: click to edit, saves on blur / Enter. */
function InlineField({ label, value, onSave, multiline, canEdit, type = 'text', options, render }: { label: string; value?: string | number | null; onSave: (v: string) => Promise<unknown>; multiline?: boolean; canEdit: boolean; type?: string; options?: { value: string; label: string }[]; render?: (v: string | number | null | undefined) => React.ReactNode }) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(String(value ?? ''));
  const [saving, setSaving] = React.useState(false);
  React.useEffect(() => setDraft(String(value ?? '')), [value]);
  const commit = async () => {
    if (draft === String(value ?? '')) { setEditing(false); return; }
    setSaving(true);
    try { await onSave(draft); setEditing(false); } finally { setSaving(false); }
  };
  return (
    <div className="group min-w-0">
      <dt className="flex items-center gap-1 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
        {canEdit && !editing ? <button type="button" className="opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100" aria-label={`Edit ${label}`} onClick={() => setEditing(true)}><Pencil className="size-3" /></button> : null}
      </dt>
      <dd className="mt-0.5 text-sm">
        {editing ? (
          <div className="flex items-start gap-1">
            {options ? (
              <SimpleSelect value={draft} onValueChange={(v) => setDraft(v)} options={options} className="h-8" />
            ) : multiline ? (
              <Textarea autoFocus rows={4} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') { setDraft(String(value ?? '')); setEditing(false); } }} />
            ) : (
              <Input autoFocus type={type} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void commit(); if (e.key === 'Escape') { setDraft(String(value ?? '')); setEditing(false); } }} />
            )}
            <Button size="icon-sm" variant="ghost" aria-label="Save" onClick={commit} loading={saving}><Check /></Button>
            <Button size="icon-sm" variant="ghost" aria-label="Cancel" onClick={() => { setDraft(String(value ?? '')); setEditing(false); }}><X /></Button>
          </div>
        ) : (
          <button type="button" className={cn('w-full whitespace-pre-wrap text-left', canEdit && 'rounded hover:bg-muted/60', !value && 'text-muted-foreground')} disabled={!canEdit} onClick={() => canEdit && setEditing(true)}>
            {render ? render(value) : value || (canEdit ? 'Click to add' : '—')}
          </button>
        )}
      </dd>
    </div>
  );
}

function OverviewTab({ eng }: { eng: Engagement }) {
  const can = useCan();
  const canEdit = can('engagement:manage') && eng.stage !== 'CLOSED';
  const update = useUpdateEngagement(eng.id);
  const addMember = useAddMember(eng.id);
  const removeMember = useRemoveMember(eng.id);
  const addStakeholder = useAddStakeholder(eng.id);
  const removeStakeholder = useRemoveStakeholder(eng.id);
  const addMilestone = useAddMilestone(eng.id);
  const updateMilestone = useUpdateMilestone(eng.id);
  const deleteMilestone = useDeleteMilestone(eng.id);
  const [memberOpen, setMemberOpen] = React.useState(false);
  const [member, setMember] = React.useState<{ userId: string | null; role: EngagementRole; plannedHours?: number }>({ userId: null, role: 'JUNIOR' });
  const [stakeOpen, setStakeOpen] = React.useState(false);
  const [stake, setStake] = React.useState({ name: '', email: '', title: '', organisation: '', role: 'Auditee', isPrimary: false });
  const [msOpen, setMsOpen] = React.useState(false);
  const [ms, setMs] = React.useState<{ name: string; dueDate: string; stage: string }>({ name: '', dueDate: '', stage: '' });

  const save = (field: keyof EngagementInput) => (v: string) => update.mutateAsync({ [field]: v === '' ? null : field === 'budgetHours' ? Number(v) : v } as EngagementInput);
  const milestones = [...eng.milestones].sort((a, b) => a.sortOrder - b.sortOrder || a.dueDate.localeCompare(b.dueDate));

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <Section title="Profile" className="xl:col-span-2" description={canEdit ? 'Click a field to edit. Changes save immediately.' : undefined}>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <InlineField label="Objectives" value={eng.objectives} onSave={save('objectives')} multiline canEdit={canEdit} />
          <InlineField label="Scope" value={eng.scope} onSave={save('scope')} multiline canEdit={canEdit} />
          <InlineField label="Out of scope" value={eng.outOfScope} onSave={save('outOfScope')} multiline canEdit={canEdit} />
          <InlineField label="Background" value={eng.background} onSave={save('background')} multiline canEdit={canEdit} />
          <InlineField label="Type" value={eng.type} onSave={save('type')} canEdit={canEdit} options={enumOptions(ENGAGEMENT_TYPE_LABELS)} render={(v) => ENGAGEMENT_TYPE_LABELS[v as keyof typeof ENGAGEMENT_TYPE_LABELS] ?? String(v)} />
          <InlineField label="Risk rating" value={eng.riskRating} onSave={save('riskRating')} canEdit={canEdit} options={SEVERITIES.map((s) => ({ value: s, label: humanize(s) }))} render={(v) => <SeverityBadge severity={String(v)} />} />
          <InlineField label="Period start" value={toInputDate(eng.periodStart)} onSave={save('periodStart')} type="date" canEdit={canEdit} render={(v) => fmtDate(String(v || ''))} />
          <InlineField label="Period end" value={toInputDate(eng.periodEnd)} onSave={save('periodEnd')} type="date" canEdit={canEdit} render={(v) => fmtDate(String(v || ''))} />
          <InlineField label="Planned start" value={toInputDate(eng.plannedStart)} onSave={save('plannedStart')} type="date" canEdit={canEdit} render={(v) => fmtDate(String(v || ''))} />
          <InlineField label="Planned end" value={toInputDate(eng.plannedEnd)} onSave={save('plannedEnd')} type="date" canEdit={canEdit} render={(v) => fmtDate(String(v || ''))} />
          <InlineField label="Budget hours" value={eng.budgetHours ? Number(eng.budgetHours) : ''} onSave={save('budgetHours')} type="number" canEdit={canEdit} render={(v) => fmtHours(v as number)} />
          <DescriptionItem label="Opinion"><GenericStatusBadge value={eng.opinion} tone={eng.opinion === 'SATISFACTORY' ? 'success' : eng.opinion === 'UNSATISFACTORY' ? 'danger' : eng.opinion === 'NEEDS_IMPROVEMENT' ? 'warning' : 'muted'} /></DescriptionItem>
          {eng.stage === 'REPORTING' || eng.stage === 'FOLLOW_UP' || eng.stage === 'CLOSED' ? <InlineField label="Executive summary" value={eng.executiveSummary} onSave={save('executiveSummary')} multiline canEdit={canEdit} /> : null}
        </dl>
      </Section>

      <div className="space-y-4">
        <Section title="Team" actions={canEdit ? <Button size="sm" variant="ghost" onClick={() => setMemberOpen(true)}><Plus /> Add</Button> : null} bodyClassName="p-0">
          <ul className="divide-y divide-border">
            {[{ label: 'Partner', user: eng.partner }, { label: 'Manager', user: eng.manager }, { label: 'Lead', user: eng.lead }].map((r) => (
              <li key={r.label} className="flex items-center gap-2 px-4 py-2 text-sm">
                <UserAvatar name={r.user?.displayName} size="sm" />
                <span className="flex-1 truncate">{r.user?.displayName ?? <span className="text-muted-foreground">Not assigned</span>}</span>
                <Badge variant="outline">{r.label}</Badge>
              </li>
            ))}
            {eng.members.map((m) => (
              <li key={m.id} className="group flex items-center gap-2 px-4 py-2 text-sm">
                <UserAvatar name={m.user?.displayName} src={m.user?.avatarUrl} size="sm" />
                <span className="flex-1 truncate">{m.user?.displayName ?? m.userId}{m.plannedHours ? <span className="ml-1 text-2xs text-muted-foreground">{fmtHours(m.plannedHours)}</span> : null}</span>
                <Badge variant="muted">{ENGAGEMENT_ROLE_LABELS[m.role] ?? m.role}</Badge>
                {canEdit ? <Button size="icon-sm" variant="ghost" className="opacity-0 group-hover:opacity-100" aria-label="Remove member" onClick={() => removeMember.mutate(m.userId)}><Trash2 /></Button> : null}
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Stakeholders" actions={canEdit ? <Button size="sm" variant="ghost" onClick={() => setStakeOpen(true)}><Plus /> Add</Button> : null} bodyClassName="p-0">
          {eng.stakeholders.length === 0 ? <EmptyState compact icon={<Users />} title="No stakeholders" /> : (
            <ul className="divide-y divide-border">
              {eng.stakeholders.map((s) => (
                <li key={s.id} className="group flex items-center gap-2 px-4 py-2 text-sm">
                  <div className="min-w-0 flex-1"><p className="truncate">{s.name} {s.isPrimary ? <Badge variant="accent" className="ml-1">Primary</Badge> : null}</p><p className="truncate text-2xs text-muted-foreground">{[s.title, s.organisation, s.email].filter(Boolean).join(' · ')}</p></div>
                  <Badge variant="outline">{s.role}</Badge>
                  {canEdit ? <Button size="icon-sm" variant="ghost" className="opacity-0 group-hover:opacity-100" aria-label="Remove stakeholder" onClick={() => removeStakeholder.mutate(s.id)}><Trash2 /></Button> : null}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Milestones" actions={canEdit ? <Button size="sm" variant="ghost" onClick={() => setMsOpen(true)}><Plus /> Add</Button> : null} bodyClassName="p-0">
          {milestones.length === 0 ? <EmptyState compact icon={<Milestone />} title="No milestones" /> : (
            <ol className="relative ml-6 border-l border-border py-2 pr-4">
              {milestones.map((m) => {
                const overdue = !m.completedAt && isOverdue(m.dueDate);
                return (
                  <li key={m.id} className="group relative mb-3 pl-4 last:mb-0">
                    <span className={cn('absolute -left-[7px] top-1 size-3 rounded-full border-2 bg-card', m.completedAt ? 'border-success bg-success' : overdue ? 'border-destructive' : 'border-primary')} />
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className={cn('text-sm font-medium', m.completedAt && 'text-muted-foreground line-through')}>{m.name}</p>
                        <p className={cn('text-2xs', overdue ? 'text-destructive' : 'text-muted-foreground')}>{fmtDate(m.dueDate)}{m.stage ? ` · ${STAGE_LABELS[m.stage]}` : ''}{m.completedAt ? ` · done ${fmtDate(m.completedAt)}` : ''}</p>
                      </div>
                      {canEdit ? (
                        <div className="flex opacity-0 group-hover:opacity-100">
                          <Button size="icon-sm" variant="ghost" aria-label={m.completedAt ? 'Reopen milestone' : 'Complete milestone'} onClick={() => updateMilestone.mutate({ milestoneId: m.id, completedAt: m.completedAt ? null : new Date().toISOString() })}><Check /></Button>
                          <Button size="icon-sm" variant="ghost" aria-label="Delete milestone" onClick={() => deleteMilestone.mutate(m.id)}><Trash2 /></Button>
                        </div>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Section>
      </div>

      <Dialog open={memberOpen} onOpenChange={setMemberOpen}>
        <DialogContent size="sm">
          <DialogHeader><DialogTitle>Add team member</DialogTitle></DialogHeader>
          <DialogBody className="space-y-3">
            <div className="space-y-1.5"><Label>Person</Label><UserPicker value={member.userId} onChange={(id) => setMember({ ...member, userId: id })} /></div>
            <div className="space-y-1.5"><Label>Role</Label><SimpleSelect value={member.role} onValueChange={(v) => setMember({ ...member, role: v as EngagementRole })} options={enumOptions(ENGAGEMENT_ROLE_LABELS)} /></div>
            <div className="space-y-1.5"><Label htmlFor="m-hours">Planned hours</Label><Input id="m-hours" type="number" min={0} value={member.plannedHours ?? ''} onChange={(e) => setMember({ ...member, plannedHours: e.target.value ? Number(e.target.value) : undefined })} /></div>
          </DialogBody>
          <DialogFooter><Button variant="outline" onClick={() => setMemberOpen(false)}>Cancel</Button><Button loading={addMember.isPending} disabled={!member.userId} onClick={async () => { await addMember.mutateAsync({ userId: member.userId!, role: member.role, plannedHours: member.plannedHours }); setMemberOpen(false); setMember({ userId: null, role: 'JUNIOR' }); }}>Add</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={stakeOpen} onOpenChange={setStakeOpen}>
        <DialogContent size="sm">
          <DialogHeader><DialogTitle>Add stakeholder</DialogTitle></DialogHeader>
          <DialogBody className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5"><Label htmlFor="s-name" required>Name</Label><Input id="s-name" value={stake.name} onChange={(e) => setStake({ ...stake, name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label htmlFor="s-email">Email</Label><Input id="s-email" type="email" value={stake.email} onChange={(e) => setStake({ ...stake, email: e.target.value })} /></div>
            <div className="space-y-1.5"><Label htmlFor="s-role" required>Role</Label><Input id="s-role" list="s-roles" value={stake.role} onChange={(e) => setStake({ ...stake, role: e.target.value })} /><datalist id="s-roles">{['Auditee', 'Sponsor', 'Process Owner', 'Executive', 'Regulator'].map((r) => <option key={r} value={r} />)}</datalist></div>
            <div className="space-y-1.5"><Label htmlFor="s-title">Title</Label><Input id="s-title" value={stake.title} onChange={(e) => setStake({ ...stake, title: e.target.value })} /></div>
            <div className="space-y-1.5"><Label htmlFor="s-org">Organisation</Label><Input id="s-org" value={stake.organisation} onChange={(e) => setStake({ ...stake, organisation: e.target.value })} /></div>
            <div className="col-span-2 flex items-center gap-2"><Checkbox id="s-primary" checked={stake.isPrimary} onCheckedChange={(c) => setStake({ ...stake, isPrimary: !!c })} /><Label htmlFor="s-primary">Primary contact</Label></div>
          </DialogBody>
          <DialogFooter><Button variant="outline" onClick={() => setStakeOpen(false)}>Cancel</Button><Button loading={addStakeholder.isPending} disabled={!stake.name || !stake.role} onClick={async () => { await addStakeholder.mutateAsync({ ...stake, email: stake.email || null, title: stake.title || null, organisation: stake.organisation || null }); setStakeOpen(false); setStake({ name: '', email: '', title: '', organisation: '', role: 'Auditee', isPrimary: false }); }}>Add</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={msOpen} onOpenChange={setMsOpen}>
        <DialogContent size="sm">
          <DialogHeader><DialogTitle>Add milestone</DialogTitle></DialogHeader>
          <DialogBody className="space-y-3">
            <div className="space-y-1.5"><Label htmlFor="ms-name" required>Name</Label><Input id="ms-name" value={ms.name} onChange={(e) => setMs({ ...ms, name: e.target.value })} placeholder="e.g. Fieldwork complete" /></div>
            <div className="space-y-1.5"><Label htmlFor="ms-date" required>Due date</Label><Input id="ms-date" type="date" value={ms.dueDate} onChange={(e) => setMs({ ...ms, dueDate: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Stage</Label><SimpleSelect value={ms.stage} onValueChange={(v) => setMs({ ...ms, stage: v })} options={ENGAGEMENT_STAGES.map((s) => ({ value: s, label: STAGE_LABELS[s] }))} allowClear clearLabel="Any stage" placeholder="Any stage" /></div>
          </DialogBody>
          <DialogFooter><Button variant="outline" onClick={() => setMsOpen(false)}>Cancel</Button><Button loading={addMilestone.isPending} disabled={!ms.name || !ms.dueDate} onClick={async () => { await addMilestone.mutateAsync({ name: ms.name, dueDate: new Date(ms.dueDate).toISOString(), stage: (ms.stage || null) as EngagementStage | null, sortOrder: milestones.length }); setMsOpen(false); setMs({ name: '', dueDate: '', stage: '' }); }}>Add</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WorkpapersTab({ eng }: { eng: Engagement }) {
  const router = useRouter();
  const { data, isLoading, error, refetch } = useEngagementWorkpapers(eng.id);
  const create = useCreateWorkpaper(eng.id);
  const [open, setOpen] = React.useState(false);
  const [v, setV] = React.useState({ reference: '', title: '', objective: '' });
  const columns = React.useMemo<ColumnDef<WorkpaperSummary, unknown>[]>(() => [
    { accessorKey: 'reference', header: 'Ref', cell: ({ getValue }) => <span className="font-mono text-xs">{getValue<string>()}</span>, meta: { width: '80px' } },
    { accessorKey: 'title', header: 'Workpaper', cell: ({ row }) => <Link href={`/workpapers/${row.original.id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>{row.original.title}</Link> },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <span className="flex items-center gap-1"><WorkpaperStatusBadge status={row.original.status} />{row.original.openReviewNotes ? <Badge variant="danger">{row.original.openReviewNotes} notes</Badge> : null}</span> },
    { accessorKey: 'currentVersion', header: 'Ver', cell: ({ getValue }) => `v${getValue<number>()}`, meta: { align: 'center' } },
    { id: 'preparedBy', header: 'Prepared by', cell: ({ row }) => row.original.preparedBy?.displayName ?? '—' },
    { id: 'reviewedBy', header: 'Reviewed by', cell: ({ row }) => row.original.reviewedBy?.displayName ?? '—' },
    { id: 'signedOffBy', header: 'Signed off by', cell: ({ row }) => row.original.signedOffBy?.displayName ?? '—' },
    { accessorKey: 'updatedAt', header: 'Updated', cell: ({ getValue }) => fmtDateTime(getValue<string>()) },
  ], []);
  return (
    <>
      <DataTable
        columns={columns} data={data} isLoading={isLoading} error={error} onRetry={() => refetch()}
        hideToolbar={false}
        actions={<Can permission="workpaper:prepare"><Button size="sm" onClick={() => setOpen(true)} disabled={eng.stage === 'CLOSED'}><FilePlus2 /> New workpaper</Button></Can>}
        onRowClick={(w) => router.push(`/workpapers/${w.id}`)}
        emptyIcon={<FileText />} emptyTitle="No workpapers" emptyDescription="Create workpapers from programme steps or add them directly."
        storageKey="eng-workpapers"
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="sm">
          <DialogHeader><DialogTitle>New workpaper</DialogTitle></DialogHeader>
          <DialogBody className="space-y-3">
            <div className="space-y-1.5"><Label htmlFor="wp-ref" required>Reference</Label><Input id="wp-ref" className="font-mono" placeholder="B.2.1" value={v.reference} onChange={(e) => setV({ ...v, reference: e.target.value })} /></div>
            <div className="space-y-1.5"><Label htmlFor="wp-title" required>Title</Label><Input id="wp-title" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} /></div>
            <div className="space-y-1.5"><Label htmlFor="wp-obj">Objective</Label><Textarea id="wp-obj" value={v.objective} onChange={(e) => setV({ ...v, objective: e.target.value })} /></div>
          </DialogBody>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button loading={create.isPending} disabled={!v.reference || !v.title} onClick={async () => { const wp = await create.mutateAsync({ ...v, objective: v.objective || undefined }); setOpen(false); router.push(`/workpapers/${wp.id}`); }}>Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function EvidenceTab({ eng }: { eng: Engagement }) {
  const { data, isLoading, error, refetch } = useEngagementEvidence(eng.id);
  const createEvidence = useCreateEvidence();
  const [open, setOpen] = React.useState(false);
  const [v, setV] = React.useState<{ description: string; type: EvidenceType; obtainedFrom: string; documentId?: string; fileName?: string }>({ description: '', type: 'DOCUMENT', obtainedFrom: '' });
  const columns = React.useMemo<ColumnDef<Evidence, unknown>[]>(() => [
    { accessorKey: 'reference', header: 'Ref', cell: ({ getValue }) => <span className="font-mono text-xs">{getValue<string>()}</span>, meta: { width: '80px' } },
    { accessorKey: 'description', header: 'Description', cell: ({ row }) => <div><p className="font-medium">{row.original.description}</p>{row.original.document ? <button type="button" className="inline-flex items-center gap-1 text-2xs text-primary hover:underline" onClick={(e) => { e.stopPropagation(); void downloadDocument(row.original.document!.id); }}><Paperclip className="size-3" />{row.original.document.fileName}</button> : null}</div> },
    { accessorKey: 'type', header: 'Type', cell: ({ getValue }) => EVIDENCE_TYPE_LABELS[getValue<EvidenceType>()] ?? humanize(getValue<string>()) },
    { accessorKey: 'obtainedFrom', header: 'Obtained from', cell: ({ getValue }) => getValue<string>() ?? '—' },
    { id: 'workpaper', header: 'Workpaper', cell: ({ row }) => (row.original.workpaperId ? <Link href={`/workpapers/${row.original.workpaperId}`} className="text-primary hover:underline">Open</Link> : '—') },
    { accessorKey: 'obtainedAt', header: 'Obtained', cell: ({ row }) => fmtDate(row.original.obtainedAt ?? row.original.createdAt) },
    { id: 'obtainedBy', header: 'By', cell: ({ row }) => row.original.obtainedBy?.displayName ?? '—' },
  ], []);
  return (
    <>
      <DataTable columns={columns} data={data} isLoading={isLoading} error={error} onRetry={() => refetch()} actions={<Can permission="document:upload"><Button size="sm" onClick={() => setOpen(true)}><Plus /> Add evidence</Button></Can>} emptyIcon={<Paperclip />} emptyTitle="No evidence registered" emptyDescription="Upload documents and register them as evidence from here or from a workpaper." storageKey="eng-evidence" />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Register evidence</DialogTitle></DialogHeader>
          <DialogBody className="space-y-3">
            <FileUpload ownerType="Engagement" ownerId={eng.id} multiple={false} compact onUploaded={(doc: Document) => setV((s) => ({ ...s, documentId: doc.id, fileName: doc.fileName, description: s.description || doc.fileName }))} />
            {v.fileName ? <p className="text-xs text-success">Attached: {v.fileName}</p> : null}
            <div className="space-y-1.5"><Label htmlFor="ev-desc" required>Description</Label><Input id="ev-desc" value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Type</Label><SimpleSelect value={v.type} onValueChange={(t) => setV({ ...v, type: t as EvidenceType })} options={enumOptions(EVIDENCE_TYPE_LABELS)} /></div>
              <div className="space-y-1.5"><Label htmlFor="ev-from">Obtained from</Label><Input id="ev-from" value={v.obtainedFrom} onChange={(e) => setV({ ...v, obtainedFrom: e.target.value })} /></div>
            </div>
          </DialogBody>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button loading={createEvidence.isPending} disabled={!v.description} onClick={async () => { await createEvidence.mutateAsync({ engagementId: eng.id, description: v.description, type: v.type, obtainedFrom: v.obtainedFrom || undefined, documentId: v.documentId }); setOpen(false); setV({ description: '', type: 'DOCUMENT', obtainedFrom: '' }); }}>Register</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function FindingsTab({ eng }: { eng: Engagement }) {
  const router = useRouter();
  const { data, isLoading, error, refetch } = useFindings({ engagementId: eng.id, pageSize: 200 });
  const columns = React.useMemo<ColumnDef<FindingSummary, unknown>[]>(() => [
    { accessorKey: 'reference', header: 'Ref', cell: ({ getValue }) => <span className="font-mono text-xs">{getValue<string>()}</span>, meta: { width: '70px' } },
    { accessorKey: 'title', header: 'Finding', cell: ({ row }) => <span className="font-medium">{row.original.title}</span> },
    { accessorKey: 'severity', header: 'Severity', cell: ({ getValue }) => <SeverityBadge severity={getValue<string>()} /> },
    { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <FindingStatusBadge status={getValue<string>()} /> },
    { id: 'owner', header: 'Action owner', cell: ({ row }) => row.original.actionOwner?.displayName ?? row.original.actionOwnerName ?? '—' },
    { accessorKey: 'dueDate', header: 'Due', cell: ({ row }) => <span className={cn(row.original.daysOverdue ? 'text-destructive' : '')}>{fmtDate(row.original.dueDate)}</span> },
  ], []);
  return <DataTable columns={columns} data={data?.items} isLoading={isLoading} error={error} onRetry={() => refetch()} actions={<Can permission="finding:manage"><Button size="sm" asChild><Link href={`/findings/new?engagementId=${eng.id}`}><Plus /> New finding</Link></Button></Can>} onRowClick={(f) => router.push(`/findings/${f.id}`)} emptyIcon={<ClipboardCheck />} emptyTitle="No findings" emptyDescription="Findings raised during fieldwork appear here." storageKey="eng-findings" />;
}

function RequestsTab({ eng }: { eng: Engagement }) {
  const router = useRouter();
  const { data, isLoading, error, refetch } = useRequests({ engagementId: eng.id, pageSize: 200 });
  const create = useCreateRequest();
  const [open, setOpen] = React.useState(false);
  const [v, setV] = React.useState<{ title: string; description: string; dueDate: string; assigneeId: string | null; assigneeEmail: string }>({ title: '', description: '', dueDate: '', assigneeId: null, assigneeEmail: '' });
  const columns = React.useMemo<ColumnDef<DocumentRequest, unknown>[]>(() => [
    { accessorKey: 'reference', header: 'Ref', cell: ({ getValue }) => <span className="font-mono text-xs">{getValue<string>()}</span>, meta: { width: '80px' } },
    { accessorKey: 'title', header: 'Request', cell: ({ row }) => <span className="font-medium">{row.original.title}</span> },
    { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <RequestStatusBadge status={getValue<string>()} /> },
    { id: 'assignee', header: 'Assignee', cell: ({ row }) => row.original.assignee?.displayName ?? row.original.assigneeEmail ?? '—' },
    { accessorKey: 'dueDate', header: 'Due', cell: ({ row }) => <span className={cn(isOverdue(row.original.dueDate) && row.original.status === 'OPEN' && 'text-destructive')}>{fmtDate(row.original.dueDate)}</span> },
    { id: 'docs', header: 'Docs', meta: { align: 'right' }, cell: ({ row }) => row.original.documents?.length ?? 0 },
  ], []);
  return (
    <>
      <DataTable columns={columns} data={data?.items} isLoading={isLoading} error={error} onRetry={() => refetch()} actions={<Can permission="request:manage"><Button size="sm" onClick={() => setOpen(true)}><Plus /> New request</Button></Can>} onRowClick={(r) => router.push(`/requests/${r.id}`)} emptyIcon={<Inbox />} emptyTitle="No document requests" storageKey="eng-requests" />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New document request</DialogTitle></DialogHeader>
          <DialogBody className="space-y-3">
            <div className="space-y-1.5"><Label htmlFor="rq-title" required>Title</Label><Input id="rq-title" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} /></div>
            <div className="space-y-1.5"><Label htmlFor="rq-desc">Description</Label><Textarea id="rq-desc" value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} placeholder="What is needed, period, format…" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label htmlFor="rq-due" required>Due date</Label><Input id="rq-due" type="date" value={v.dueDate} onChange={(e) => setV({ ...v, dueDate: e.target.value })} /></div>
              <div className="space-y-1.5"><Label htmlFor="rq-email">Assignee email</Label><Input id="rq-email" type="email" value={v.assigneeEmail} onChange={(e) => setV({ ...v, assigneeEmail: e.target.value })} placeholder="If not a platform user" /></div>
            </div>
            <div className="space-y-1.5"><Label>Assignee</Label><UserPicker value={v.assigneeId} onChange={(id) => setV({ ...v, assigneeId: id })} /></div>
          </DialogBody>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button loading={create.isPending} disabled={!v.title || !v.dueDate} onClick={async () => { await create.mutateAsync({ engagementId: eng.id, title: v.title, description: v.description || null, dueDate: new Date(v.dueDate).toISOString(), assigneeId: v.assigneeId, assigneeEmail: v.assigneeEmail || null }); setOpen(false); setV({ title: '', description: '', dueDate: '', assigneeId: null, assigneeEmail: '' }); }}>Raise request</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function HistoryTab({ eng }: { eng: Engagement }) {
  const can = useCan();
  const trail = useAuditTrail({ targetType: 'Engagement', targetId: eng.id, pageSize: 50 }, can('audit_trail:read'));
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Section title="Stage history">
        <HistoryTimeline entries={eng.stageHistory.map((h) => ({ id: h.id, from: h.fromStage, to: h.toStage, actor: h.changedBy, comment: h.comment, at: h.changedAt }))} labelFor={(k) => STAGE_LABELS[k as EngagementStage] ?? humanize(k)} />
      </Section>
      {can('audit_trail:read') ? (
        <Section title="Audit trail" description="Every change recorded against this engagement." bodyClassName="p-0">
          {trail.isLoading ? <div className="p-4"><SkeletonRows rows={5} /></div> : trail.error ? <ErrorState error={trail.error} compact onRetry={() => trail.refetch()} /> : !trail.data?.items.length ? <EmptyState compact title="No entries" /> : (
            <ul className="divide-y divide-border">
              {trail.data.items.map((e) => (
                <li key={String(e.id)} className="px-4 py-2.5">
                  <div className="flex items-center justify-between gap-2 text-xs"><span className="font-medium">{humanize(e.action.replace(/\./g, '_'))}</span><span className="text-muted-foreground">{fmtDateTime(e.occurredAt)}</span></div>
                  <p className="text-2xs text-muted-foreground">{e.actor?.displayName ?? e.actorEmail ?? 'System'}</p>
                  {e.before || e.after ? <div className="mt-2"><JsonDiff before={e.before} after={e.after} /></div> : null}
                </li>
              ))}
            </ul>
          )}
        </Section>
      ) : null}
    </div>
  );
}

export default function EngagementDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const params = useSearchParams();
  const tab = (TABS.includes(params.get('tab') as Tab) ? params.get('tab') : 'overview') as Tab;
  const { data: eng, isLoading, error, refetch } = useEngagement(id);
  const transition = useEngagementTransition(id);

  const setTab = (t: string) => { const sp = new URLSearchParams(params.toString()); sp.set('tab', t); router.replace(`/engagements/${id}?${sp}`, { scroll: false }); };

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-4 w-48" /><Skeleton className="h-8 w-2/3" /><Skeleton className="h-16 w-full" /><SkeletonRows rows={6} /></div>;
  if (error || !eng) return <ErrorState error={error} onRetry={() => refetch()} />;

  const counts = eng.counts ?? {};
  const steps = ENGAGEMENT_STAGES.map((s) => ({ key: s, label: STAGE_LABELS[s] }));

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Engagements', href: '/engagements' }, { label: eng.auditNumber }]}
        title={eng.title}
        meta={<><Badge variant="outline" className="font-mono normal-case tracking-normal">{eng.auditNumber}</Badge><StageBadge stage={eng.stage} /><SeverityBadge severity={eng.riskRating} />{eng.status !== 'ACTIVE' ? <GenericStatusBadge value={eng.status} tone="warning" /> : null}</>}
        description={<>{eng.entity ? <Link href={`/universe?entity=${eng.entity.id}`} className="hover:underline">{eng.entity.name}</Link> : 'No entity'} · {ENGAGEMENT_TYPE_LABELS[eng.type] ?? eng.type}{eng.lead ? ` · Lead ${eng.lead.displayName}` : ''}{eng.plannedStart ? ` · ${fmtDate(eng.plannedStart)} – ${fmtDate(eng.plannedEnd)}` : ''}</>}
        actions={<><ReportExport path={`/reports/engagements/${eng.id}`} /><WorkflowActions machine={ENGAGEMENT_WORKFLOW} state={eng.stage} serverActions={eng.availableActions} onTransition={(action, comment) => transition.mutateAsync({ action, comment })} isPending={transition.isPending} /></>}
      >
        <div className="surface px-4 py-3">
          <StageStepper steps={steps} current={eng.stage} terminalKeys={['CLOSED']} />
          {typeof eng.progressPct === 'number' ? <div className="mt-3 flex items-center gap-2"><Progress value={eng.progressPct} size="sm" className="flex-1" /><span className="text-xs tabular-nums text-muted-foreground">{Math.round(eng.progressPct)}% complete</span></div> : null}
        </div>
      </PageHeader>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="programme">Programme</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="workpapers">Workpapers {counts.workpapers !== undefined ? <Badge variant="muted">{counts.workpapers}</Badge> : eng.workpaperCount !== undefined ? <Badge variant="muted">{eng.workpaperCount}</Badge> : null}</TabsTrigger>
          <TabsTrigger value="evidence">Evidence {counts.evidence !== undefined ? <Badge variant="muted">{counts.evidence}</Badge> : null}</TabsTrigger>
          <TabsTrigger value="findings">Findings {counts.openFindings ?? eng.openFindingsCount ? <Badge variant="danger">{counts.openFindings ?? eng.openFindingsCount}</Badge> : null}</TabsTrigger>
          <TabsTrigger value="requests">Requests {counts.requests !== undefined ? <Badge variant="muted">{counts.requests}</Badge> : null}</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="report">Report</TabsTrigger>
          <TabsTrigger value="comments">Comments</TabsTrigger>
        </TabsList>
        <TabsContent value="overview"><OverviewTab eng={eng} /></TabsContent>
        <TabsContent value="programme"><ProgrammeTab engagementId={eng.id} /></TabsContent>
        <TabsContent value="documents"><DocumentsPanel ownerType="Engagement" ownerId={eng.id} /></TabsContent>
        <TabsContent value="workpapers"><WorkpapersTab eng={eng} /></TabsContent>
        <TabsContent value="evidence"><EvidenceTab eng={eng} /></TabsContent>
        <TabsContent value="findings"><FindingsTab eng={eng} /></TabsContent>
        <TabsContent value="requests"><RequestsTab eng={eng} /></TabsContent>
        <TabsContent value="history"><HistoryTab eng={eng} /></TabsContent>
        <TabsContent value="report"><ReportTab engagement={eng} /></TabsContent>
        <TabsContent value="comments"><Section title="Discussion"><CommentsThread targetType="Engagement" targetId={eng.id} /></Section></TabsContent>
      </Tabs>
    </>
  );
}
