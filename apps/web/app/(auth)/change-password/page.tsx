'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { KeyRound, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { api, errorMessage } from '@/lib/api';
import { homePathFor, useCurrentUser, useSignOut } from '@/lib/auth';

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Enter the temporary password'),
    newPassword: z
      .string()
      .min(12, 'Use at least 12 characters')
      .regex(/[A-Z]/, 'Include an uppercase letter')
      .regex(/[a-z]/, 'Include a lowercase letter')
      .regex(/[0-9]/, 'Include a number'),
    confirm: z.string(),
  })
  .refine((value) => value.newPassword === value.confirm, {
    path: ['confirm'],
    message: 'Passwords do not match',
  });

type Values = z.infer<typeof schema>;

export default function ChangePasswordPage() {
  const router = useRouter();
  const { user, isLoading, refetch } = useCurrentUser();
  const signOut = useSignOut();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirm: '' },
  });

  React.useEffect(() => {
    if (!isLoading && user && !user.mustChangePassword) router.replace(homePathFor(user));
  }, [isLoading, router, user]);

  const submit = async (values: Values) => {
    setServerError(null);
    try {
      await api.post('/auth/password/change', {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      const result = await refetch();
      router.replace(homePathFor(result.data ?? null));
    } catch (error) {
      setServerError(errorMessage(error, 'Could not change the password'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="mb-3 inline-flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <KeyRound className="size-5" />
        </div>
        <h1 className="text-2xl font-semibold">Replace temporary password</h1>
        <p className="text-sm text-muted-foreground">
          Your bootstrap password is temporary. Choose a private password before using AuditSphere.
        </p>
      </div>

      <Form {...form}>
        <form className="space-y-4" onSubmit={form.handleSubmit(submit)} noValidate>
          <FormField
            control={form.control}
            name="currentPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>Temporary password</FormLabel>
                <FormControl><Input type="password" autoComplete="current-password" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="newPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>New password</FormLabel>
                <FormControl><Input type="password" autoComplete="new-password" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirm"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>Confirm new password</FormLabel>
                <FormControl><Input type="password" autoComplete="new-password" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {serverError ? (
            <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {serverError}
            </p>
          ) : null}
          <Button type="submit" className="w-full" loading={form.formState.isSubmitting} disabled={!user}>
            <KeyRound /> Save new password
          </Button>
        </form>
      </Form>

      <Button variant="ghost" className="w-full" onClick={() => signOut.mutate()} loading={signOut.isPending}>
        <LogOut /> Sign out
      </Button>
    </div>
  );
}
