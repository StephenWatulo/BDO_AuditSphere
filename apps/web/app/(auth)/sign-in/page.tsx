'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';
import { api, errorMessage } from '@/lib/api';
import { ME_QUERY_KEY } from '@/lib/auth';
import type { LoginResponse } from '@/lib/types';

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});
type Values = z.infer<typeof schema>;

function MicrosoftLogo() {
  return (
    <svg viewBox="0 0 21 21" className="size-4" aria-hidden>
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}

function safeReturnTo(v: string | null): string {
  if (!v || !v.startsWith('/') || v.startsWith('//')) return '/';
  return v;
}

function SignInForm() {
  const router = useRouter();
  const qc = useQueryClient();
  const params = useSearchParams();
  const returnTo = safeReturnTo(params.get('returnTo'));
  const [showPassword, setShowPassword] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });

  const onSubmit = async (values: Values) => {
    setServerError(null);
    try {
      const res = await api.post<LoginResponse>('/auth/login', values, { noRefresh: true });
      if (res.mfaRequired && res.mfaToken) {
        sessionStorage.setItem('as.mfaToken', res.mfaToken);
        sessionStorage.setItem('as.returnTo', returnTo);
        router.replace('/mfa');
        return;
      }
      if (res.user) qc.setQueryData(ME_QUERY_KEY, res.user);
      router.replace(returnTo);
    } catch (e) {
      setServerError(errorMessage(e, 'Sign in failed'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="text-sm text-muted-foreground">Use your BDO account to continue.</p>
      </div>

      <Button variant="outline" className="w-full" asChild>
        <a href={`/api/v1/auth/entra/start?returnTo=${encodeURIComponent(returnTo)}`}>
          <MicrosoftLogo /> Sign in with Microsoft
        </a>
      </Button>

      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-2xs uppercase tracking-wider text-muted-foreground">or with email</span>
        <Separator className="flex-1" />
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" autoComplete="email" placeholder="you@bdo-ea.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      className="pr-9"
                      {...field}
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword((s) => !s)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {serverError ? (
            <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {serverError}
            </p>
          ) : null}
          <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>
            <LogIn /> Sign in
          </Button>
        </form>
      </Form>
      <p className="text-center text-xs text-muted-foreground">
        Access is provisioned by your administrator. Contact IT support if you cannot sign in.
      </p>
    </div>
  );
}

export default function SignInPage() {
  return (
    <React.Suspense fallback={null}>
      <SignInForm />
    </React.Suspense>
  );
}
