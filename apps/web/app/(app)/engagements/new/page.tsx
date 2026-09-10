'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { SEVERITIES } from '@auditsphere/shared';
import { PageHeader, Section } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { SimpleSelect } from '@/components/ui/select';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { EntityPicker } from '@/components/domain/entity-picker';
import { UserPicker } from '@/components/domain/user-picker';
import { useCreateEngagement } from '@/lib/queries/engagements';
import { ENGAGEMENT_TYPE_LABELS, enumOptions } from '@/lib/labels';
import { humanize } from '@/lib/utils';

const TYPES = ['INTERNAL_AUDIT', 'OPERATIONAL', 'FINANCIAL', 'COMPLIANCE', 'IT', 'INVESTIGATION', 'ADVISORY', 'FOLLOW_UP', 'INTEGRATED'] as const;

const schema = z
  .object({
    title: z.string().min(3, 'Title is required'),
    type: z.enum(TYPES),
    entityId: z.string().optional().nullable(),
    riskRating: z.enum(SEVERITIES),
    objectives: z.string().optional(),
    scope: z.string().optional(),
    periodStart: z.string().optional(),
    periodEnd: z.string().optional(),
    plannedStart: z.string().optional(),
    plannedEnd: z.string().optional(),
    budgetHours: z.coerce.number().min(0).optional(),
    leadId: z.string().optional().nullable(),
    managerId: z.string().optional().nullable(),
    partnerId: z.string().optional().nullable(),
  })
  .refine((v) => !v.plannedStart || !v.plannedEnd || v.plannedStart <= v.plannedEnd, { path: ['plannedEnd'], message: 'Planned end must be after planned start' })
  .refine((v) => !v.periodStart || !v.periodEnd || v.periodStart <= v.periodEnd, { path: ['periodEnd'], message: 'Period end must be after period start' });
type Values = z.infer<typeof schema>;

export default function NewEngagementPage() {
  const router = useRouter();
  const create = useCreateEngagement();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { title: '', type: 'OPERATIONAL', riskRating: 'MEDIUM', entityId: null, leadId: null, managerId: null, partnerId: null, objectives: '', scope: '' } });

  const submit = async (v: Values) => {
    const eng = await create.mutateAsync({
      ...v,
      objectives: v.objectives || null,
      scope: v.scope || null,
      periodStart: v.periodStart || null,
      periodEnd: v.periodEnd || null,
      plannedStart: v.plannedStart || null,
      plannedEnd: v.plannedEnd || null,
      budgetHours: v.budgetHours ?? null,
    });
    router.push(`/engagements/${eng.id}`);
  };

  return (
    <>
      <PageHeader title="New engagement" description="The audit number is generated automatically." crumbs={[{ label: 'Engagements', href: '/engagements' }, { label: 'New' }]} />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(submit)} className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Section title="Profile" className="lg:col-span-2" bodyClassName="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
            <FormField control={form.control} name="title" render={({ field }) => (<FormItem className="sm:col-span-2"><FormLabel required>Title</FormLabel><FormControl><Input placeholder="e.g. Procurement to payment review" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="type" render={({ field }) => (<FormItem><FormLabel required>Type</FormLabel><FormControl><SimpleSelect value={field.value} onValueChange={field.onChange} options={enumOptions(ENGAGEMENT_TYPE_LABELS)} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="riskRating" render={({ field }) => (<FormItem><FormLabel>Risk rating</FormLabel><FormControl><SimpleSelect value={field.value} onValueChange={field.onChange} options={SEVERITIES.map((s) => ({ value: s, label: humanize(s) }))} /></FormControl></FormItem>)} />
            <FormField control={form.control} name="entityId" render={({ field }) => (<FormItem className="sm:col-span-2"><FormLabel>Auditable entity</FormLabel><FormControl><EntityPicker value={field.value} onChange={(id) => field.onChange(id)} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="objectives" render={({ field }) => (<FormItem className="sm:col-span-2"><FormLabel>Objectives</FormLabel><FormControl><Textarea rows={4} {...field} /></FormControl><FormDescription>Required before moving to risk assessment.</FormDescription><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="scope" render={({ field }) => (<FormItem className="sm:col-span-2"><FormLabel>Scope</FormLabel><FormControl><Textarea rows={4} {...field} /></FormControl><FormMessage /></FormItem>)} />
          </Section>
          <div className="space-y-4">
            <Section title="Team" bodyClassName="space-y-3 p-4">
              <FormField control={form.control} name="leadId" render={({ field }) => (<FormItem><FormLabel>Lead</FormLabel><FormControl><UserPicker value={field.value} onChange={(id) => field.onChange(id)} /></FormControl><FormDescription>Required before moving to risk assessment.</FormDescription></FormItem>)} />
              <FormField control={form.control} name="managerId" render={({ field }) => (<FormItem><FormLabel>Manager</FormLabel><FormControl><UserPicker value={field.value} onChange={(id) => field.onChange(id)} /></FormControl></FormItem>)} />
              <FormField control={form.control} name="partnerId" render={({ field }) => (<FormItem><FormLabel>Partner</FormLabel><FormControl><UserPicker value={field.value} onChange={(id) => field.onChange(id)} /></FormControl></FormItem>)} />
            </Section>
            <Section title="Timeline and budget" bodyClassName="grid grid-cols-2 gap-3 p-4">
              <FormField control={form.control} name="periodStart" render={({ field }) => (<FormItem><FormLabel>Period start</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="periodEnd" render={({ field }) => (<FormItem><FormLabel>Period end</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="plannedStart" render={({ field }) => (<FormItem><FormLabel>Planned start</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="plannedEnd" render={({ field }) => (<FormItem><FormLabel>Planned end</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="budgetHours" render={({ field }) => (<FormItem className="col-span-2"><FormLabel>Budget hours</FormLabel><FormControl><Input type="number" min={0} {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
            </Section>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
              <Button type="submit" loading={create.isPending}>Create engagement</Button>
            </div>
          </div>
        </form>
      </Form>
    </>
  );
}
