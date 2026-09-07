'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Copy, KeyRound, ShieldCheck, ShieldOff } from 'lucide-react';
import { PageHeader, Section } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { QrCode } from '@/components/domain/qr-code';
import { api, errorMessage } from '@/lib/api';
import { ME_QUERY_KEY, useCurrentUser } from '@/lib/auth';
import { copyToClipboard } from '@/lib/utils';
import type { MfaSetupResponse } from '@/lib/types';

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: z
      .string()
      .min(12, 'Use at least 12 characters')
      .regex(/[A-Z]/, 'Include an uppercase letter')
      .regex(/[a-z]/, 'Include a lowercase letter')
      .regex(/[0-9]/, 'Include a number'),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });
type PasswordValues = z.infer<typeof passwordSchema>;

function CopyButton({ value, label }: { value: string; label: string }) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={`Copy ${label}`}
      onClick={async () => {
        const ok = await copyToClipboard(value);
        toast[ok ? 'success' : 'error'](ok ? `${label} copied` : 'Could not copy');
      }}
    >
      <Copy />
    </Button>
  );
}

export default function SecurityPage() {
  const qc = useQueryClient();
  const { user } = useCurrentUser();
  const [setup, setSetup] = React.useState<MfaSetupResponse | null>(null);
  const [code, setCode] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [recoveryCodes, setRecoveryCodes] = React.useState<string[] | null>(null);
  const [disableOpen, setDisableOpen] = React.useState(false);
  const [disableCode, setDisableCode] = React.useState('');

  const startSetup = async () => {
    setBusy(true);
    try {
      const res = await api.post<MfaSetupResponse>('/auth/mfa/setup');
      setSetup(res);
      setCode('');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const enable = async () => {
    setBusy(true);
    try {
      const res = await api.post<{ recoveryCodes: string[] }>('/auth/mfa/enable', { code: code.trim() });
      setRecoveryCodes(res.recoveryCodes);
      setSetup(null);
      await qc.invalidateQueries({ queryKey: ME_QUERY_KEY });
      toast.success('Two-step verification enabled');
    } catch (e) {
      toast.error(errorMessage(e, 'Invalid code'));
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      await api.post('/auth/mfa/disable', { code: disableCode.trim() });
      setDisableOpen(false);
      setDisableCode('');
      await qc.invalidateQueries({ queryKey: ME_QUERY_KEY });
      toast.success('Two-step verification disabled');
    } catch (e) {
      toast.error(errorMessage(e, 'Invalid code'));
    } finally {
      setBusy(false);
    }
  };

  const pwForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirm: '' },
  });

  const secretGroups = setup?.secret.match(/.{1,4}/g)?.join(' ') ?? setup?.secret;

  return (
    <>
      <PageHeader title="Security" crumbs={[{ label: 'Settings' }, { label: 'Security' }]} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section
          title="Two-step verification"
          description="Time-based one-time passwords (TOTP) with an authenticator app such as Microsoft Authenticator."
          actions={
            user?.mfaEnabled ? (
              <Badge variant="success"><ShieldCheck className="size-3" /> Enabled</Badge>
            ) : (
              <Badge variant="warning"><ShieldOff className="size-3" /> Not enabled</Badge>
            )
          }
        >
          {user?.mfaEnabled ? (
            <div className="space-y-3">
              <p className="text-sm">Your account is protected. You will be asked for a code from your authenticator app at each sign in.</p>
              <Button variant="outline" onClick={() => setDisableOpen(true)}>
                Disable two-step verification
              </Button>
            </div>
          ) : setup ? (
            <div className="space-y-4">
              <ol className="list-decimal space-y-1 pl-5 text-sm">
                <li>Open your authenticator app and choose to add an account.</li>
                <li>Scan the QR code, or enter the secret manually.</li>
                <li>Enter the 6-digit code shown by the app to confirm.</li>
              </ol>
              <div className="flex flex-col gap-4 sm:flex-row">
                <QrCode value={setup.otpauthUrl} size={176} label="Authenticator enrolment QR code" className="border border-border" />
                <div className="min-w-0 flex-1 space-y-3">
                  <div>
                    <Label>Secret</Label>
                    <div className="mt-1 flex items-center gap-1">
                      <code className="flex-1 truncate rounded-md border border-border bg-muted px-2 py-1.5 font-mono text-xs">{secretGroups}</code>
                      <CopyButton value={setup.secret} label="Secret" />
                    </div>
                  </div>
                  <div>
                    <Label>Setup link</Label>
                    <div className="mt-1 flex items-center gap-1">
                      <code className="flex-1 truncate rounded-md border border-border bg-muted px-2 py-1.5 font-mono text-2xs">{setup.otpauthUrl}</code>
                      <CopyButton value={setup.otpauthUrl} label="Setup link" />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="mfa-enable-code">Verification code</Label>
                    <div className="mt-1 flex items-center gap-2">
                      <Input
                        id="mfa-enable-code"
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        inputMode="numeric"
                        placeholder="000000"
                        className="w-32 text-center font-mono tracking-[0.4em]"
                      />
                      <Button onClick={enable} loading={busy} disabled={code.length !== 6}>
                        Confirm
                      </Button>
                      <Button variant="ghost" onClick={() => setSetup(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Two-step verification is required for all audit-function roles. Enable it now to protect client data.
              </p>
              <Button onClick={startSetup} loading={busy}>
                <ShieldCheck /> Set up authenticator
              </Button>
            </div>
          )}
        </Section>

        <Section title="Change password" description={user?.authProvider === 'ENTRA_ID' ? 'Your password is managed by Microsoft Entra ID.' : 'Choose a strong, unique password.'}>
          {user?.authProvider === 'ENTRA_ID' ? (
            <p className="text-sm text-muted-foreground">Sign in with Microsoft manages your credentials. There is nothing to change here.</p>
          ) : (
            <Form {...pwForm}>
              <form
                className="space-y-3"
                onSubmit={pwForm.handleSubmit(async (v) => {
                  try {
                    await api.post('/auth/password/change', { currentPassword: v.currentPassword, newPassword: v.newPassword });
                    toast.success('Password changed');
                    pwForm.reset();
                  } catch (e) {
                    toast.error(errorMessage(e, 'Could not change password'));
                  }
                })}
              >
                <FormField control={pwForm.control} name="currentPassword" render={({ field }) => (
                  <FormItem><FormLabel required>Current password</FormLabel><FormControl><Input type="password" autoComplete="current-password" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={pwForm.control} name="newPassword" render={({ field }) => (
                  <FormItem><FormLabel required>New password</FormLabel><FormControl><Input type="password" autoComplete="new-password" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={pwForm.control} name="confirm" render={({ field }) => (
                  <FormItem><FormLabel required>Confirm new password</FormLabel><FormControl><Input type="password" autoComplete="new-password" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="flex justify-end">
                  <Button type="submit" loading={pwForm.formState.isSubmitting}>
                    <KeyRound /> Update password
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </Section>
      </div>

      <Dialog open={!!recoveryCodes} onOpenChange={(o) => !o && setRecoveryCodes(null)}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Save your recovery codes</DialogTitle>
            <DialogDescription>
              Each code can be used once if you lose access to your authenticator. Store them somewhere safe - they will not be shown again.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="grid grid-cols-2 gap-1.5 rounded-md border border-border bg-muted p-3 font-mono text-xs">
              {recoveryCodes?.map((c) => (
                <span key={c}>{c}</span>
              ))}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => recoveryCodes && copyToClipboard(recoveryCodes.join('\n')).then(() => toast.success('Codes copied'))}>
              <Copy /> Copy all
            </Button>
            <Button onClick={() => setRecoveryCodes(null)}>I have saved them</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={disableOpen} onOpenChange={setDisableOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Disable two-step verification</DialogTitle>
            <DialogDescription>Confirm with a current authenticator code or a recovery code.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <Label htmlFor="mfa-disable-code">Code</Label>
            <Input id="mfa-disable-code" className="mt-1 font-mono" value={disableCode} onChange={(e) => setDisableCode(e.target.value)} autoFocus />
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisableOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={disable} loading={busy} disabled={!disableCode.trim()}>Disable</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
