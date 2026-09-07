'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { SEVERITIES } from '@auditsphere/shared';
import { PageHeader, Section } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { SimpleSelect } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useCreateFinding, useFindings } from '@/lib/queries/findings';
import { useEngagements, useEngagementWorkpapers } from '@/lib/queries/engagements';
import { useEntitiesFlat, useProcesses } from '@/lib/queries/universe';
import { useRisks } from '@/lib/queries/risks';
import { useControls } from '@/lib/queries/controls';
import { ROOT_CAUSE_LABELS, enumOptions } from '@/lib/labels';
import { humanize } from '@/lib/utils';

const ROOT_CAUSES = ['PEOPLE', 'PROCESS', 'TECHNOLOGY', 'GOVERNANCE', 'EXTERNAL', 'DATA', 'POLICY'] as const;

const schema = z.object({
  engagementId: z.string().min(1, 'Select the engagement this finding belongs to'),
  title: z.string().min(3, 'Title is required'),
  severity: z.enum(SEVERITIES),
  condition: z.string().min(10, 'Describe the condition observed (at least 10 characters)'),
  criteria: z.string().min(10, 'State the criteria or standard expected (at least 10 characters)'),
  cause: z.string().optional(),
  impact: z.string().optional(),
  recommendation: z.string().optional(),
  workpaperId: z.string().optional().nullable(),
  entityId: z.string().optional().nullable(),
  processId: z.string().optional().nullable(),
  riskId: z.string().optional().nullable(),
  controlId: z.string().optional().nullable(),
  rootCauseCategory: z.enum(ROOT_CAUSES).optional().nullable(),
  repeatOfId: z.string().optional().nullable(),
});
type Values = z.infer<typeof schema>;

function NewFindingForm() {
  const router = useRouter();
  const params = useSearchParams();
  const prefillEngagement = params.get('engagementId') ?? '';
  const create = useCreateFinding();

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { engagementId: prefillEngagement, title: '', severity: 'MEDIUM', condition: '', criteria: '', cause: '', impact: '', recommendation: '', workpaperId: null, entityId: null, processId: null, riskId: null, controlId: null, rootCauseCategory: null, repeatOfId: null },
  });
  const engagementId = form.watch('engagementId');
  const entityId = form.watch('entityId');

  const engagements = useEngagements({ pageSize: 200, sort: 'auditNumber:desc' });
  const workpapers = useEngagementWorkpapers(engagementId || undefined);
  const entities = useEntitiesFlat({ pageSize: 200 });
  const processes = useProcesses(entityId || undefined);
  const risks = useRisks({ pageSize: 200, sort: 'code:asc', entityId: entityId || undefined });
  const controls = useControls({ pageSize: 200, sort: 'code:asc' });
  const priorFindings = useFindings({ pageSize: 200, entityId: entityId || undefined, sort: 'createdAt:desc' }, !!entityId);

  // When the engagement changes, default the entity to the engagement entity.
  const selectedEngagement = engagements.data?.items.find((e) => e.id === engagementId);
  React.useEffect(() => {
    if (selectedEngagement?.entity && !form.getValues('entityId')) form.setValue('entityId', selectedEngagement.entity.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEngagement?.id]);

  const submit = async (v: Values) => {
    const created = await create.mutateAsync({
      engagementId: v.engagementId,
      title: v.title.trim(),
      severity: v.severity,
      condition: v.condition.trim(),
      criteria: v.criteria.trim(),
      cause: v.cause?.trim() || null,
      impact: v.impact?.trim() || null,
      recommendation: v.recommendation?.trim() || null,
      workpaperId: v.workpaperId || null,
      entityId: v.entityId || null,
      processId: v.processId || null,
      riskId: v.riskId || null,
      controlId: v.controlId || null,
      rootCauseCategory: v.rootCauseCategory || null,
      repeatOfId: v.repeatOfId || null,
    });
    router.push(`/findings/${created.id}`);
  };

  const engagementOptions = (engagements.data?.items ?? []).filter((e) => e.stage !== 'CLOSED' || e.id === prefillEngagement).map((e) => ({ value: e.id, label: `${e.auditNumber} · ${e.title}` }));

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Section title="Finding" bodyClassName="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FormField control={form.control} name="engagementId" render={({ field }) => (<FormItem className="sm:col-span-2"><FormLabel required>Engagement</FormLabel><FormControl><SimpleSelect value={field.value} onValueChange={field.onChange} options={engagementOptions} placeholder={engagements.isLoading ? 'Loading…' : 'Select engagement'} disabled={!!prefillEngagement} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="severity" render={({ field }) => (<FormItem><FormLabel required>Severity</FormLabel><FormControl><SimpleSelect value={field.value} onValueChange={field.onChange} options={SEVERITIES.map((s) => ({ value: s, label: humanize(s) }))} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="title" render={({ field }) => (<FormItem className="sm:col-span-3"><FormLabel required>Title</FormLabel><FormControl><Input placeholder="e.g. Purchase orders approved above delegated authority" {...field} /></FormControl><FormMessage /></FormItem>)} />
          </Section>

          <Section title="The five Cs" description="Condition and criteria are required to submit the finding to management; a recommendation is required as well.">
            <div className="space-y-3">
              <FormField control={form.control} name="condition" render={({ field }) => (<FormItem><FormLabel required>Condition</FormLabel><FormControl><Textarea rows={4} placeholder="What was found: the factual evidence observed" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="criteria" render={({ field }) => (<FormItem><FormLabel required>Criteria</FormLabel><FormControl><Textarea rows={3} placeholder="What should be: the policy, standard or expectation" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="cause" render={({ field }) => (<FormItem><FormLabel>Cause</FormLabel><FormControl><Textarea rows={3} placeholder="Why the condition exists" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="impact" render={({ field }) => (<FormItem><FormLabel>Impact (consequence)</FormLabel><FormControl><Textarea rows={3} placeholder="The risk or effect of the condition" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="recommendation" render={({ field }) => (<FormItem><FormLabel>Recommendation (corrective action)</FormLabel><FormControl><Textarea rows={3} placeholder="What management should do" {...field} /></FormControl><FormDescription>Required before submitting to management. Detailed recommendations can be added individually after creation.</FormDescription><FormMessage /></FormItem>)} />
            </div>
          </Section>
        </div>

        <div className="space-y-4">
          <Section title="Links" bodyClassName="space-y-3 p-4">
            <FormField control={form.control} name="workpaperId" render={({ field }) => (<FormItem><FormLabel>Workpaper</FormLabel><FormControl><SimpleSelect value={field.value ?? ''} onValueChange={(v) => field.onChange(v || null)} options={(workpapers.data ?? []).map((w) => ({ value: w.id, label: `${w.reference} · ${w.title}` }))} allowClear clearLabel="None" placeholder={!engagementId ? 'Select an engagement first' : workpapers.isLoading ? 'Loading…' : 'Select workpaper'} disabled={!engagementId} /></FormControl></FormItem>)} />
            <FormField control={form.control} name="entityId" render={({ field }) => (<FormItem><FormLabel>Auditable entity</FormLabel><FormControl><SimpleSelect value={field.value ?? ''} onValueChange={(v) => { field.onChange(v || null); form.setValue('processId', null); }} options={(entities.data?.items ?? []).map((e) => ({ value: e.id, label: `${e.code} · ${e.name}` }))} allowClear clearLabel="None" placeholder={entities.isLoading ? 'Loading…' : 'Select entity'} /></FormControl></FormItem>)} />
            <FormField control={form.control} name="processId" render={({ field }) => (<FormItem><FormLabel>Process</FormLabel><FormControl><SimpleSelect value={field.value ?? ''} onValueChange={(v) => field.onChange(v || null)} options={(processes.data ?? []).map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` }))} allowClear clearLabel="None" placeholder={!entityId ? 'Select an entity first' : 'Select process'} disabled={!entityId} /></FormControl></FormItem>)} />
            <FormField control={form.control} name="riskId" render={({ field }) => (<FormItem><FormLabel>Risk</FormLabel><FormControl><SimpleSelect value={field.value ?? ''} onValueChange={(v) => field.onChange(v || null)} options={(risks.data?.items ?? []).map((r) => ({ value: r.id, label: `${r.code} · ${r.title}` }))} allowClear clearLabel="None" placeholder={risks.isLoading ? 'Loading…' : 'Select risk'} /></FormControl></FormItem>)} />
            <FormField control={form.control} name="controlId" render={({ field }) => (<FormItem><FormLabel>Control</FormLabel><FormControl><SimpleSelect value={field.value ?? ''} onValueChange={(v) => field.onChange(v || null)} options={(controls.data?.items ?? []).map((c) => ({ value: c.id, label: `${c.code} · ${c.title}` }))} allowClear clearLabel="None" placeholder={controls.isLoading ? 'Loading…' : 'Select control'} /></FormControl></FormItem>)} />
          </Section>
          <Section title="Classification" bodyClassName="space-y-3 p-4">
            <FormField control={form.control} name="rootCauseCategory" render={({ field }) => (<FormItem><FormLabel>Root cause category</FormLabel><FormControl><SimpleSelect value={field.value ?? ''} onValueChange={(v) => field.onChange(v || null)} options={enumOptions(ROOT_CAUSE_LABELS)} allowClear clearLabel="Not classified" placeholder="Select category" /></FormControl></FormItem>)} />
            <FormField control={form.control} name="repeatOfId" render={({ field }) => (<FormItem><FormLabel>Repeat of</FormLabel><FormControl><SimpleSelect value={field.value ?? ''} onValueChange={(v) => field.onChange(v || null)} options={(priorFindings.data?.items ?? []).map((f) => ({ value: f.id, label: `${f.engagement?.auditNumber ?? ''} ${f.reference} · ${f.title}` }))} allowClear clearLabel="Not a repeat" placeholder={!entityId ? 'Select an entity to list prior findings' : 'Select prior finding'} disabled={!entityId} /></FormControl><FormDescription>Flags the finding as a repeat for committee reporting.</FormDescription></FormItem>)} />
          </Section>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" loading={create.isPending}>Create finding</Button>
          </div>
        </div>
      </form>
    </Form>
  );
}

export default function NewFindingPage() {
  return (
    <>
      <PageHeader title="New finding" description="The reference is generated per engagement (F-01, F-02, …)." crumbs={[{ label: 'Findings', href: '/findings' }, { label: 'New' }]} />
      <React.Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <NewFindingForm />
      </React.Suspense>
    </>
  );
}
