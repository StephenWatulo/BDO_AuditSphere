'use client';

import * as React from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Copy, KeyRound, MoreHorizontal, ShieldCheck, UserPlus, UserX, UserCheck, Users } from 'lucide-react';
import { toast } from 'sonner';
import { ROLE_KEYS, ROLE_LABELS, type RoleKey } from '@auditsphere/shared';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { DataTable } from '@/components/ui/data-table';
import { ChipSelect } from '@/components/ui/filter-chips';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { UserAvatar } from '@/components/ui/avatar';
import { GenericStatusBadge } from '@/components/domain/badges';
import { useCurrentUser } from '@/lib/auth';
import { useListParams } from '@/lib/hooks/use-list-params';
import { useCreateUser, useRoles, useSetUserRoles, useUpdateUser, useUsers, type CreateUserInput } from '@/lib/queries/users';
import { fmtDateTime, fmtRelative } from '@/lib/format';
import { copyToClipboard } from '@/lib/utils';
import type { User, UserStatus } from '@/lib/types';

const DEFAULTS = { page: 1, pageSize: 25, q: '', sort: '', status: undefined as string | undefined, role: undefined as string | undefined };
const STATUS_LABELS: Record<UserStatus, string> = { INVITED: 'Invited', ACTIVE: 'Active', SUSPENDED: 'Suspended', DEACTIVATED: 'Deactivated' };
const STATUS_TONES: Record<UserStatus, 'info' | 'success' | 'warning' | 'muted'> = { INVITED: 'info', ACTIVE: 'success', SUSPENDED: 'warning', DEACTIVATED: 'muted' };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function RoleCheckboxes({ value, onChange, idPrefix }: { value: RoleKey[]; onChange: (roles: RoleKey[]) => void; idPrefix: string }) {
  const roles = useRoles();
  const byKey = new Map((roles.data ?? []).map((r) => [r.key, r]));
  return (
    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
      {ROLE_KEYS.map((key) => {
        const checked = value.includes(key);
        const meta = byKey.get(key);
        return (
          <label key={key} htmlFor={`${idPrefix}-${key}`} className="flex cursor-pointer items-start gap-2 rounded-md border border-border px-2.5 py-2 text-sm hover:bg-muted/60 has-[:checked]:border-primary/40 has-[:checked]:bg-accent/40">
            <Checkbox id={`${idPrefix}-${key}`} checked={checked} onCheckedChange={(c) => onChange(c ? [...value, key] : value.filter((r) => r !== key))} className="mt-0.5" />
            <span className="min-w-0">
              <span className="block font-medium leading-tight">{ROLE_LABELS[key]}</span>
              <span className="block text-2xs text-muted-foreground">{meta?.description ?? (meta ? `${meta.permissions.length} permissions` : '')}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

function InviteDialog({ open, onOpenChange, onInvited }: { open: boolean; onOpenChange: (o: boolean) => void; onInvited: (user: User, temporaryPassword?: string) => void }) {
  const create = useCreateUser();
  const [v, setV] = React.useState<{ email: string; firstName: string; lastName: string; displayName: string; jobTitle: string; roles: RoleKey[]; password: string }>({ email: '', firstName: '', lastName: '', displayName: '', jobTitle: '', roles: ['JUNIOR_AUDITOR'], password: '' });
  const [touchedName, setTouchedName] = React.useState(false);
  React.useEffect(() => { if (open) { setV({ email: '', firstName: '', lastName: '', displayName: '', jobTitle: '', roles: ['JUNIOR_AUDITOR'], password: '' }); setTouchedName(false); } }, [open]);
  React.useEffect(() => { if (!touchedName) setV((s) => ({ ...s, displayName: [s.firstName, s.lastName].filter(Boolean).join(' ') })); }, [v.firstName, v.lastName, touchedName]);

  const emailOk = EMAIL_RE.test(v.email.trim());
  const pwOk = !v.password || v.password.length >= 10;
  const valid = emailOk && v.displayName.trim().length >= 2 && v.roles.length > 0 && pwOk;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader><DialogTitle>Invite user</DialogTitle><DialogDescription>Without a password the user is created as Invited and a temporary password is shown once. Users signing in with Microsoft Entra ID are provisioned automatically on first login.</DialogDescription></DialogHeader>
        <DialogBody className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="inv-email" required>Email</Label><Input id="inv-email" type="email" autoFocus value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} placeholder="name@bdo-ea.com" aria-invalid={!!v.email && !emailOk} />{v.email && !emailOk ? <p className="text-xs text-destructive">Enter a valid email address.</p> : null}</div>
            <div className="space-y-1.5"><Label htmlFor="inv-first">First name</Label><Input id="inv-first" value={v.firstName} onChange={(e) => setV({ ...v, firstName: e.target.value })} /></div>
            <div className="space-y-1.5"><Label htmlFor="inv-last">Last name</Label><Input id="inv-last" value={v.lastName} onChange={(e) => setV({ ...v, lastName: e.target.value })} /></div>
            <div className="space-y-1.5"><Label htmlFor="inv-display" required>Display name</Label><Input id="inv-display" value={v.displayName} onChange={(e) => { setTouchedName(true); setV({ ...v, displayName: e.target.value }); }} /></div>
            <div className="space-y-1.5"><Label htmlFor="inv-title">Job title</Label><Input id="inv-title" value={v.jobTitle} onChange={(e) => setV({ ...v, jobTitle: e.target.value })} placeholder="e.g. Senior Auditor" /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="inv-pw">Password (optional)</Label><Input id="inv-pw" type="password" autoComplete="new-password" value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} placeholder="Leave blank to generate a temporary password" aria-invalid={!pwOk} />{!pwOk ? <p className="text-xs text-destructive">Passwords must be at least 10 characters.</p> : null}</div>
          </div>
          <div className="space-y-1.5">
            <Label required>Roles</Label>
            <RoleCheckboxes idPrefix="inv" value={v.roles} onChange={(roles) => setV({ ...v, roles })} />
            {v.roles.length === 0 ? <p className="text-xs text-destructive">Select at least one role.</p> : null}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button loading={create.isPending} disabled={!valid} onClick={async () => {
            const input: CreateUserInput = { email: v.email.trim().toLowerCase(), displayName: v.displayName.trim(), firstName: v.firstName.trim() || undefined, lastName: v.lastName.trim() || undefined, jobTitle: v.jobTitle.trim() || undefined, roles: v.roles, password: v.password || undefined };
            const created = await create.mutateAsync(input);
            onOpenChange(false);
            onInvited(created, created.temporaryPassword);
          }}><UserPlus /> Invite</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TemporaryPasswordDialog({ state, onClose }: { state: { user: User; password: string } | null; onClose: () => void }) {
  const [copied, setCopied] = React.useState(false);
  React.useEffect(() => { if (state) setCopied(false); }, [state]);
  return (
    <Dialog open={!!state} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><KeyRound className="size-4 text-primary" /> Temporary password</DialogTitle><DialogDescription>Share this with {state?.user.displayName} through a secure channel. It is shown only once and must be changed at first sign-in.</DialogDescription></DialogHeader>
        <DialogBody className="space-y-3">
          <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
            <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Sign-in email</p>
            <p className="font-mono text-sm">{state?.user.email}</p>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Temporary password</p>
              <p className="select-all break-all font-mono text-base">{state?.password}</p>
            </div>
            <Button size="sm" variant="outline" onClick={async () => { if (state && (await copyToClipboard(state.password))) { setCopied(true); toast.success('Copied to clipboard'); } else toast.error('Could not copy'); }}><Copy /> {copied ? 'Copied' : 'Copy'}</Button>
          </div>
        </DialogBody>
        <DialogFooter><Button onClick={onClose}>Done</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RolesDialog({ user, onClose }: { user: User | null; onClose: () => void }) {
  const setRoles = useSetUserRoles(user?.id ?? '');
  const [roles, setRolesState] = React.useState<RoleKey[]>([]);
  React.useEffect(() => { if (user) setRolesState(user.roles ?? []); }, [user]);
  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="lg">
        <DialogHeader><DialogTitle>Edit roles</DialogTitle><DialogDescription>{user?.displayName} · {user?.email}. Permissions are the union of the selected roles and take effect on the next request.</DialogDescription></DialogHeader>
        <DialogBody>
          <RoleCheckboxes idPrefix="edit" value={roles} onChange={setRolesState} />
          {roles.length === 0 ? <p className="mt-2 text-xs text-destructive">A user must have at least one role.</p> : null}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button loading={setRoles.isPending} disabled={roles.length === 0} onClick={async () => { await setRoles.mutateAsync({ roles }); onClose(); }}><ShieldCheck /> Save roles</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatusConfirm({ target, onClose }: { target: { user: User; status: UserStatus } | null; onClose: () => void }) {
  const update = useUpdateUser(target?.user.id ?? '');
  const deactivating = target?.status === 'DEACTIVATED';
  const suspending = target?.status === 'SUSPENDED';
  return (
    <ConfirmDialog
      open={!!target}
      onOpenChange={(o) => !o && onClose()}
      title={deactivating ? `Deactivate ${target?.user.displayName}?` : suspending ? `Suspend ${target?.user.displayName}?` : `Reactivate ${target?.user.displayName}?`}
      description={deactivating ? 'The user can no longer sign in. Their history, sign-offs and assignments are kept. You can reactivate them later.' : suspending ? 'Sign-in is blocked until the account is reactivated.' : 'The user will be able to sign in again with their existing roles.'}
      confirmLabel={deactivating ? 'Deactivate' : suspending ? 'Suspend' : 'Reactivate'}
      destructive={deactivating || suspending}
      loading={update.isPending}
      onConfirm={async () => { if (!target) return; await update.mutateAsync({ status: target.status }); onClose(); }}
    />
  );
}

function UsersTable() {
  const { user: me } = useCurrentUser();
  const { state, set, sorting, setSorting, reset } = useListParams(DEFAULTS);
  const query = useUsers({ page: state.page, pageSize: state.pageSize, q: state.q, sort: state.sort, status: state.status, role: state.role });
  const [invite, setInvite] = React.useState(false);
  const [tempPw, setTempPw] = React.useState<{ user: User; password: string } | null>(null);
  const [rolesFor, setRolesFor] = React.useState<User | null>(null);
  const [statusTarget, setStatusTarget] = React.useState<{ user: User; status: UserStatus } | null>(null);

  const columns = React.useMemo<ColumnDef<User, unknown>[]>(
    () => [
      {
        accessorKey: 'displayName',
        header: 'Name',
        cell: ({ row }) => (
          <span className="flex min-w-0 items-center gap-2">
            <UserAvatar name={row.original.displayName} src={row.original.avatarUrl} size="sm" />
            <span className="min-w-0">
              <span className="block truncate font-medium">{row.original.displayName}{row.original.id === me?.id ? <span className="ml-1 text-2xs text-muted-foreground">(you)</span> : null}</span>
              {row.original.jobTitle ? <span className="block truncate text-2xs text-muted-foreground">{row.original.jobTitle}</span> : null}
            </span>
          </span>
        ),
      },
      { accessorKey: 'email', header: 'Email', cell: ({ getValue }) => <span className="font-mono text-xs">{getValue<string>()}</span> },
      { id: 'roles', header: 'Roles', cell: ({ row }) => <span className="flex flex-wrap gap-1">{(row.original.roles ?? []).map((r) => <Badge key={r} variant="outline" className="normal-case tracking-normal">{ROLE_LABELS[r] ?? r}</Badge>)}</span> },
      { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <GenericStatusBadge value={getValue<UserStatus>()} labels={STATUS_LABELS} tone={STATUS_TONES[getValue<UserStatus>()] ?? 'secondary'} /> },
      { id: 'auth', header: 'Sign-in', cell: ({ row }) => <span className="text-xs">{row.original.authProvider === 'ENTRA_ID' ? 'Entra ID' : 'Password'}{row.original.mfaEnabled ? <Badge variant="success" className="ml-1">MFA</Badge> : null}</span> },
      { accessorKey: 'lastLoginAt', header: 'Last login', cell: ({ getValue }) => { const v = getValue<string | null>(); return v ? <span title={fmtDateTime(v)}>{fmtRelative(v)}</span> : <span className="text-muted-foreground">Never</span>; } },
      { accessorKey: 'createdAt', header: 'Created', cell: ({ getValue }) => fmtDateTime(getValue<string>()) },
      {
        id: 'actions',
        header: '',
        enableHiding: false,
        meta: { width: '48px', align: 'right' },
        cell: ({ row }) => {
          const u = row.original;
          const isMe = u.id === me?.id;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${u.displayName}`} onClick={(e) => e.stopPropagation()}><MoreHorizontal /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuLabel>{u.displayName}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setRolesFor(u)}><ShieldCheck /> Edit roles</DropdownMenuItem>
                {u.status === 'ACTIVE' || u.status === 'INVITED' ? (
                  <>
                    <DropdownMenuItem disabled={isMe} onSelect={() => setStatusTarget({ user: u, status: 'SUSPENDED' })}><UserX /> Suspend</DropdownMenuItem>
                    <DropdownMenuItem disabled={isMe} className="text-destructive focus:text-destructive" onSelect={() => setStatusTarget({ user: u, status: 'DEACTIVATED' })}><UserX /> Deactivate</DropdownMenuItem>
                  </>
                ) : (
                  <DropdownMenuItem onSelect={() => setStatusTarget({ user: u, status: 'ACTIVE' })}><UserCheck /> Reactivate</DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [me?.id],
  );

  const chips = [];
  if (state.status) chips.push({ key: 'status', label: `Status: ${STATUS_LABELS[state.status as UserStatus] ?? state.status}`, onRemove: () => set({ status: undefined }) });
  if (state.role) chips.push({ key: 'role', label: `Role: ${ROLE_LABELS[state.role as RoleKey] ?? state.role}`, onRemove: () => set({ role: undefined }) });

  return (
    <>
      <DataTable
        columns={columns}
        data={query.data?.items}
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
        total={query.data?.total}
        page={state.page}
        pageSize={state.pageSize}
        onPageChange={(page) => set({ page })}
        onPageSizeChange={(pageSize) => set({ pageSize, page: 1 })}
        sorting={sorting}
        onSortingChange={setSorting}
        search={state.q}
        onSearchChange={(q) => set({ q })}
        searchPlaceholder="Search by name or email…"
        chips={chips}
        onClearFilters={reset}
        toolbar={
          <>
            <ChipSelect label="Status" options={(Object.keys(STATUS_LABELS) as UserStatus[]).map((s) => ({ value: s, label: STATUS_LABELS[s] }))} value={state.status} onChange={(v) => set({ status: v as string | undefined })} />
            <ChipSelect label="Role" options={ROLE_KEYS.map((r) => ({ value: r, label: ROLE_LABELS[r] }))} value={state.role} onChange={(v) => set({ role: v as string | undefined })} />
          </>
        }
        actions={<Button size="sm" onClick={() => setInvite(true)}><UserPlus /> Invite user</Button>}
        rowClassName={(u) => (u.status === 'DEACTIVATED' ? 'opacity-60' : undefined)}
        emptyIcon={<Users />}
        emptyTitle="No users"
        emptyDescription="Invite your audit team and business contacts."
        storageKey="admin-users"
        initialHidden={['createdAt']}
      />
      <InviteDialog open={invite} onOpenChange={setInvite} onInvited={(u, pw) => { if (pw) setTempPw({ user: u, password: pw }); }} />
      <TemporaryPasswordDialog state={tempPw} onClose={() => setTempPw(null)} />
      <RolesDialog user={rolesFor} onClose={() => setRolesFor(null)} />
      <StatusConfirm target={statusTarget} onClose={() => setStatusTarget(null)} />
    </>
  );
}

export default function AdminUsersPage() {
  return (
    <>
      <PageHeader title="Users" description="Manage accounts, roles and access for the tenant." crumbs={[{ label: 'Admin' }, { label: 'Users' }]} />
      <React.Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <UsersTable />
      </React.Suspense>
    </>
  );
}
