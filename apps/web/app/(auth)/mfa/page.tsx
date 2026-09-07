'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, errorMessage } from '@/lib/api';
import { ME_QUERY_KEY } from '@/lib/auth';
import type { LoginResponse } from '@/lib/types';

export default function MfaPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [mfaToken, setMfaToken] = React.useState<string | null>(null);
  const [code, setCode] = React.useState('');
  const [useRecovery, setUseRecovery] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const t = sessionStorage.getItem('as.mfaToken');
    if (!t) {
      router.replace('/sign-in');
      return;
    }
    setMfaToken(t);
    inputRef.current?.focus();
  }, [router]);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!mfaToken || !code.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<LoginResponse>('/auth/mfa/verify', { mfaToken, code: code.trim() }, { noRefresh: true });
      if (res.user) qc.setQueryData(ME_QUERY_KEY, res.user);
      const returnTo = sessionStorage.getItem('as.returnTo') || '/';
      sessionStorage.removeItem('as.mfaToken');
      sessionStorage.removeItem('as.returnTo');
      router.replace(returnTo);
    } catch (err) {
      setError(errorMessage(err, 'Verification failed'));
      setCode('');
      inputRef.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  React.useEffect(() => {
    if (!useRecovery && /^\d{6}$/.test(code)) void submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, useRecovery]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="mb-3 inline-flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <ShieldCheck className="size-5" />
        </div>
        <h1 className="text-2xl font-semibold">Two-step verification</h1>
        <p className="text-sm text-muted-foreground">
          {useRecovery
            ? 'Enter one of your recovery codes. Each code can be used once.'
            : 'Enter the 6-digit code from your authenticator app.'}
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="mfa-code">{useRecovery ? 'Recovery code' : 'Verification code'}</Label>
          <Input
            id="mfa-code"
            ref={inputRef}
            value={code}
            onChange={(e) => setCode(useRecovery ? e.target.value : e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode={useRecovery ? 'text' : 'numeric'}
            autoComplete="one-time-code"
            placeholder={useRecovery ? 'xxxx-xxxx-xxxx' : '000000'}
            className={useRecovery ? 'font-mono' : 'text-center font-mono text-lg tracking-[0.5em]'}
            aria-invalid={!!error}
          />
        </div>
        {error ? (
          <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="w-full" loading={busy} disabled={!code.trim()}>
          Verify
        </Button>
      </form>

      <div className="flex items-center justify-between text-xs">
        <button
          type="button"
          className="inline-flex items-center gap-1 text-primary hover:underline"
          onClick={() => {
            setUseRecovery((v) => !v);
            setCode('');
            setError(null);
          }}
        >
          <KeyRound className="size-3.5" /> {useRecovery ? 'Use authenticator code' : 'Use a recovery code'}
        </button>
        <Link href="/sign-in" className="text-muted-foreground hover:underline">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
