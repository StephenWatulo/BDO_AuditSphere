'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { ROLE_LABELS } from '@auditsphere/shared';
import { PageHeader, Section, DescriptionItem } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/avatar';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { SkeletonCard } from '@/components/ui/skeleton';
import { ME_QUERY_KEY, useCurrentUser } from '@/lib/auth';
import { useUpdateUser } from '@/lib/queries/users';
import { fmtDateTime } from '@/lib/format';

const schema = z.object({
  displayName: z.string().min(2, 'Display name is required'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  jobTitle: z.string().optional(),
  phone: z.string().optional(),
  officeLocation: z.string().optional(),
});
type Values = z.infer<typeof schema>;

function ProfileForm({ userId, defaults }: { userId: string; defaults: Values }) {
  const qc = useQueryClient();
  const update = useUpdateUser(userId);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults });

  return (
    <Form {...form}>
      <form
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        onSubmit={form.handleSubmit(async (values) => {
          await update.mutateAsync(values);
          await qc.invalidateQueries({ queryKey: ME_QUERY_KEY });
        })}
      >
        <FormField control={form.control} name="displayName" render={({ field }) => (
          <FormItem className="sm:col-span-2"><FormLabel required>Display name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="firstName" render={({ field }) => (
          <FormItem><FormLabel>First name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="lastName" render={({ field }) => (
          <FormItem><FormLabel>Last name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="jobTitle" render={({ field }) => (
          <FormItem><FormLabel>Job title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="phone" render={({ field }) => (
          <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="officeLocation" render={({ field }) => (
          <FormItem className="sm:col-span-2"><FormLabel>Office location</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <div className="sm:col-span-2 flex justify-end">
          <Button type="submit" loading={update.isPending} disabled={!form.formState.isDirty}>Save changes</Button>
        </div>
      </form>
    </Form>
  );
}

export default function ProfilePage() {
  const { user, isLoading } = useCurrentUser();

  return (
    <>
      <PageHeader title="Profile" crumbs={[{ label: 'Settings' }, { label: 'Profile' }]} />
      {isLoading || !user ? (
        <SkeletonCard />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Section className="lg:col-span-1" title="Account">
            <div className="flex items-center gap-3">
              <UserAvatar name={user.displayName} src={user.avatarUrl} size="lg" />
              <div className="min-w-0">
                <p className="truncate font-semibold">{user.displayName}</p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-1 gap-3">
              <DescriptionItem label="Roles">
                <div className="flex flex-wrap gap-1">
                  {user.roles.map((r) => (
                    <Badge key={r} variant="secondary">{ROLE_LABELS[r] ?? r}</Badge>
                  ))}
                </div>
              </DescriptionItem>
              <DescriptionItem label="Sign-in method">{user.authProvider === 'ENTRA_ID' ? 'Microsoft Entra ID' : 'Email and password'}</DescriptionItem>
              <DescriptionItem label="Tenant">{user.tenant?.name ?? '—'}</DescriptionItem>
              <DescriptionItem label="Last sign in">{fmtDateTime(user.lastLoginAt)}</DescriptionItem>
              <DescriptionItem label="Permissions">{user.permissions.length} granted</DescriptionItem>
            </dl>
          </Section>
          <Section className="lg:col-span-2" title="Personal details" description="Shown on engagements, review stamps and the audit trail.">
            <ProfileForm
              userId={user.id}
              defaults={{
                displayName: user.displayName ?? '',
                firstName: user.firstName ?? '',
                lastName: user.lastName ?? '',
                jobTitle: user.jobTitle ?? '',
                phone: user.phone ?? '',
                officeLocation: user.officeLocation ?? '',
              }}
            />
          </Section>
        </div>
      )}
    </>
  );
}
